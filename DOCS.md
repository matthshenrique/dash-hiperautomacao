# Dashboard Comercial — Documentação Técnica

Documento para entender **de onde saem os dados, como cada métrica é calculada, o que é
validado e o que tem de limitação**, além de como **replicar** o dashboard para outra
operação.

---

## 1. Stack

| Camada | Tecnologia | Papel |
|---|---|---|
| Runtime | **Cloudflare Workers** | roda a API e serve o front (edge, sem servidor) |
| Banco | **Cloudflare D1** (SQLite) | guarda leads, eventos, insights, mensagens, metas |
| Agendamento | **Cloudflare Cron Triggers** | dispara os syncs automáticos |
| Backend | **Hono** + TypeScript | rotas `/api/*` |
| Frontend | **React 18 + Vite** | dashboard (SPA), CSS puro (sem lib de charts) |
| Testes | **Vitest** | testes unitários das métricas |

**Custo:** roda dentro do plano gratuito da Cloudflare para uma operação deste porte.

**Sem N8N, sem servidor.** Todo o pipeline (puxar API → gravar no banco → exibir) vive
dentro de um único Worker.

---

## 2. Arquitetura e fluxo de dados

```
  Kommo API ─┐
  Meta API  ─┼─►  Cron (Worker)  ─►  D1 (SQLite)  ─►  /api/*  ─►  Dashboard (React)
  Evolution ─┘      "sync"            "cache"           "leitura"
```

Princípio: **o dashboard nunca chama Kommo/Meta/Evolution direto.** Um processo de _sync_
puxa os dados das APIs em intervalos, normaliza e grava no D1. O dashboard só lê o D1 —
por isso é rápido e não depende das APIs estarem no ar no momento do acesso.

- Escrita incremental: cada fonte guarda um **cursor** (`sync_state`) e só puxa o que mudou
  desde o último ciclo.
- Toda gravação é **idempotente** (`INSERT ... ON CONFLICT`), então re-sincronizar não
  duplica dado.
- Cada ciclo grava um registro em `sync_log` (visível em `/api/sync-log`) com
  `ok` / `error` / `skipped`, número de linhas e horário.
- **Alerta ativo:** a cada ciclo do cron de 15min, [`src/sync/health.ts`](src/sync/health.ts)
  compara a idade/status do último `sync_log` de cada fonte contra os mesmos limites do
  widget `/api/sync-status` (warn > 2x o intervalo esperado, crit > 4x ou `status=error`) e,
  se alguma fonte **virou** `crit` (ou saiu de `crit` pra `ok`), envia um `POST` pra
  `ALERT_WEBHOOK_URL` (secret opcional — Slack/Discord/n8n). O último estado notificado por
  fonte fica em `alert_state`, pra só alertar de novo quando o estado **mudar** (não fica
  reenviando a cada 15min enquanto continua crit). Sem a secret configurada, a checagem só
  grava `skipped` em `sync_log` e não faz nada — configure com:

  ```sh
  wrangler secret put ALERT_WEBHOOK_URL
  ```

### Rotas de leitura — [`src/router.ts`](src/router.ts) / [`src/api/handlers.ts`](src/api/handlers.ts)

O front sempre buscou os dados de uma tela em **6 chamadas GET separadas**
(`/api/overview`, `/api/funnel`, `/api/meetings`, `/api/revenue`, `/api/creatives`,
`/api/response`), cada uma com seu próprio round-trip HTTP. Só que várias delas repetiam
**a mesma query de leads** (`leadsCreatedInRange` / `leadsClosedInRange`) e outras bases
(`ad_insights`, `crm_statuses`, `lead_events`, `wa_messages`) — ou seja, a mesma leitura no
D1 rodava várias vezes redundantes para montar uma única carga de tela.

Por isso existe **`GET /api/dashboard?from=&to=`**: roda cada query de base **uma única
vez** e devolve tudo num só JSON, com a mesma chave/formato de cada endpoint antigo:

```json
{
  "overview": { ... },   // igual ao retorno de /api/overview
  "funnel":   { ... },   // igual ao retorno de /api/funnel
  "meetings": { ... },   // igual ao retorno de /api/meetings
  "revenue":  { ... },   // igual ao retorno de /api/revenue
  "creatives":{ ... },   // igual ao retorno de /api/creatives
  "response": { ... }    // igual ao retorno de /api/response
}
```

O front (`web/src/App.tsx`) usa só esse endpoint. **Os 6 endpoints antigos continuam
existindo** (não foram removidos) por compatibilidade e para facilitar depuração isolada de
uma seção — eles só deixaram de ser chamados pela tela principal.

### Cadência (Cron) — [`wrangler.jsonc`](wrangler.jsonc)

| Agenda | O que roda | Frequência |
|---|---|---|
| `*/15 * * * *` | **Kommo** (leads, eventos, reuniões, receita, exclusões, etapas) | a cada **15 min** |
| `0 */2 * * *` | **Meta** (gasto/resultados) + **Evolution** (WhatsApp) | a cada **2 h** |

CRM quase em tempo real; anúncios e WhatsApp a cada 2h (APIs mais pesadas). O endpoint
**`/api/sync?key=…`** dispara tudo manualmente, sem esperar o cron — por padrão a Meta roda
**incremental** (hoje+ontem); passe **`&full=true`** pra forçar o backfill de 90 dias
(mais lento, só necessário no primeiro carregamento ou pra reprocessar histórico).

**Cooldown:** pra ninguém ficar forçando sync em excesso, o endpoint tem um limite mínimo
entre disparos — **5 min** no modo incremental, **1h** no `full=true` (`checkManualSyncCooldown`
em [`src/api/handlers.ts`](src/api/handlers.ts), guardado em `sync_state` sob as chaves
`manual_sync`/`manual_sync_full`, sem migration nova). Dentro do cooldown, responde `429`
com `{ started: false, retryInSec }`. O botão "Sincronizar agora" no dashboard (dentro do
widget de status) só expõe o modo incremental — `full=true` fica só como parâmetro de URL,
de uso técnico.

---

## 3. Fontes de dados

### 3.1 Kommo (CRM) — [`src/lib/kommoClient.ts`](src/lib/kommoClient.ts)
- `GET /leads` (paginado, `with=loss_reason`, incremental por `updated_at`) → leads, valor
  de venda, motivo de perda, campos de UTM e produto.
- `GET /events?filter[type]=lead_status_changed` → **histórico de mudança de etapa** (base das reuniões).
- `GET /events?filter[type]=lead_deleted` → leads excluídos (removidos do banco).
- `GET /leads/pipelines` → **nomes das etapas** (para rotular receita por status).

### 3.2 Meta Ads — [`src/lib/metaClient.ts`](src/lib/metaClient.ts)
- `GET /{ad_account}/insights` nível **anúncio**, 1 linha por dia (`time_increment=1`),
  campos `spend, impressions, clicks, actions, ad_name, campaign_name`.
- "Leads/resultados" = soma dos `actions` cujo `action_type` está em
  [`CLIENT.metaResultActions`](config/client.ts). Cada campanha otimiza por um evento
  diferente; por isso a lista é configurável (ex.: `lead`, `offsite_conversion.fb_pixel_custom`).

### 3.3 Evolution API (WhatsApp) — [`src/lib/evolutionClient.ts`](src/lib/evolutionClient.ts)
- `POST /chat/findMessages/{instancia}` → metadados das mensagens (`id`, `remoteJid`,
  `fromMe`, `messageTimestamp`). **Não guarda conteúdo de mensagem**, só horário/direção,
  o suficiente para tempo de resposta.

---

## 4. Modelo de dados (D1) — [`migrations/`](migrations/)

| Tabela | Conteúdo |
|---|---|
| `leads` | 1 linha por lead: etapa, valor, datas, motivo de perda, UTMs, produto |
| `lead_events` | mudanças de etapa (`status_before` → `status_after`) — base das reuniões |
| `ad_insights` | 1 linha por anúncio/dia: gasto, impressões, cliques, resultados |
| `wa_messages` | metadados de mensagens do WhatsApp (tempo de resposta) |
| `crm_statuses` | id → nome das etapas do Kommo |
| `meta_goals` | meta de receita/leads por mês (editável no dash) |
| `sync_state` | cursor incremental por fonte |
| `sync_log` | histórico de execuções de sync |
| `alert_state` | último estado de saúde (ok/warn/crit) notificado por fonte — evita spam de alerta |

---

## 5. Catálogo de métricas

Legenda de **fonte**: `Kommo` (CRM), `Meta` (anúncios), `WA` (WhatsApp).
Arquivos de cálculo em [`src/metrics/`](src/metrics/), todos cobertos por testes em [`tests/`](tests/).

### KPIs principais — [`src/metrics/overview.ts`](src/metrics/overview.ts)

| Métrica | Fonte | Cálculo |
|---|---|---|
| **Investido** | Meta | soma de `spend` dos insights no período |
| **Leads gerados** | Kommo | contagem de leads **criados** no período (`created_at`, pipeline comercial) |
| **Ganhos** | Kommo | leads na etapa **Ganho** (status 142) **fechados** no período (`closed_at`) |
| **Perdidos** | Kommo | leads na etapa **Perdido** (status 143) **fechados** no período (`closed_at`) |
| **Receita** | Kommo | soma do `price` dos leads ganhos fechados no período |
| **Ticket médio** | Kommo | receita ÷ ganhos |
| **CAC** | Meta+Kommo | investido ÷ ganhos |
| **CPL** | Meta+Kommo | investido ÷ leads gerados |
| **Taxa de conversão** | Kommo | ganhos ÷ leads gerados |
| **Taxa de fechamento** | Kommo | ganhos ÷ (ganhos + perdidos) — só entre os já decididos |
| **Taxa de perda** | Kommo | perdidos ÷ leads gerados |
| **Tempo de conversão** | Kommo | média de (`closed_at` − `created_at`) dos ganhos |
| **Meta do mês** | manual | progresso = receita ÷ meta (editável, salvo no D1) |

> **Duas janelas de data, não uma.** "Leads gerados" e as etapas em aberto do funil
> (follow-up/agendado/no-show/cancelado) filtram por **`created_at`** — é a contagem de quem
> entrou no período. Ganhos, perdidos, receita, ticket médio, tempo de conversão e os
> painéis de receita/criativos/campanhas filtram por **`closed_at`** — é o que o próprio
> Kommo mostra no filtro "Fechado" na tela de leads, e pode incluir leads **criados fora**
> do período selecionado (fecharam agora, mas entraram antes). Antes dessa correção, tudo
> era filtrado por `created_at`, o que sub-contava ganhos/perdidos sempre que o fechamento
> acontecia depois da criação — ver [`src/api/handlers.ts`](src/api/handlers.ts)
> (`leadsCreatedInRange` vs. `leadsClosedInRange`).

### Reuniões — [`src/metrics/meetings.ts`](src/metrics/meetings.ts)  ⭐ (pergunta da agência)

Fonte: **`lead_events`** (mudanças de etapa vindas do Kommo). O cálculo lê a transição
`status_before → status_after` de cada evento no período:

- **Realizadas** — evento em que o card **saiu da etapa "Agendado"** para uma etapa de
  avanço (qualquer etapa que **não** seja Agendado, No-show ou Cancelado). Ou seja: estava
  agendado e progrediu → a reunião aconteceu.
- **Canceladas** — evento cujo destino é **No-show** ou **Cancelado**.
- **Remarcadas** — lead que **entrou na etapa "Agendado" 2 ou mais vezes** (foi reagendado).

> **Como sabemos que uma reunião foi feita?** Não por um "botão de reunião", e sim pelo
> **movimento do card no funil**: sair de _Agendado_ para uma etapa seguinte é o sinal de
> realizada; ir para _No-show/Cancelado_ é cancelada; voltar para _Agendado_ de novo é
> remarcada. Isso depende de o comercial mover o card — ver **validações** (§7).

> **No-show separado:** hoje No-show e Cancelado são somados em "Canceladas" (o rodapé do
> card diz "No-show / canceladas"). Separar em dois números é trivial — os dois status já
> são distintos no [`config`](config/client.ts) (`noShow` e `cancelado`). É só pedir.

### Receita — [`src/metrics/revenue.ts`](src/metrics/revenue.ts)

- **Receita por status do CRM** — soma de `price` agrupada por etapa. O nome da etapa vem
  de `crm_statuses` (puxado do Kommo); etapa sem nome cai em "Status {id}".
- **Receita por origem** — receita dos **ganhos** agrupada por `utm_source`. Lead sem UTM
  cai em "(sem origem)".
- **Produtos vendidos** — ganhos agrupados pelo campo **Produto** (custom field): quantidade,
  receita e **ticket médio por produto**.

### Criativos e campanhas via UTM — [`src/metrics/creatives.ts`](src/metrics/creatives.ts)  ⭐ (pergunta da agência)

**O Kommo (UTM) é a fonte única de leads e conversão.** A Meta entra só com `spend`
(investido) — não conta mais leads/resultados nesses painéis. Antes, "geração de leads" e a
coluna "Leads" do funil por campanha vinham do `leads` da Meta (soma de `actions` cujo
`action_type` está em `metaResultActions`); isso divergia do Kommo sempre que o evento
otimizado pela campanha não batia 1:1 com um lead real no CRM. Hoje:

- **Lado Meta:** só `spend` (investido) por `ad_name`/`campaign_name` — usado no CPL/CAC/ROAS.
- **Lado Kommo** (leads e conversão): cada lead traz, em custom fields, o **UTM congelado no
  clique** (`utm_source`, `utm_campaign`, `utm_content`) — ver §6. A contagem de leads
  (geração) e de ganhos (conversão) vem sempre daqui.

Painéis:

1. **Criativos — geração de leads (Kommo):** anúncios da Meta (spend) casados por nome
   (`ad_name` ↔ `utm_content`, normalizado) com a contagem de leads do Kommo. CPL = spend da
   Meta ÷ leads do Kommo. → "qual criativo mais **traz** lead".
2. **Criativos — conversão em venda (Kommo):** leads **ganhos** agrupados por `utm_content`.
   → "qual criativo mais **vira venda**".
3. **Campanhas — funil completo:** junta `campaign_name` (Meta, spend) com `utm_campaign`
   (Kommo, leads e ganhos), normalizado (minúsculo/trim). Entrega, por campanha: leads,
   investido, vendas, **taxa de conversão**, receita, **ROAS**, CAC.

> **Por que criativo é separado e campanha é unido?** O `utm_content` grava o **nome do
> anúncio no momento do clique** (via macro `{{ad.name}}` na URL). Se o anúncio for
> **renomeado** depois, o nome atual (que a Meta mostra) passa a divergir do nome congelado
> no lead — então cruzar criativo-a-criativo geraria par errado. Já o **nome da campanha é
> estável** (raramente renomeado), então o cruzamento por campanha é confiável. Por isso o
> "criativo ganhador" aparece nas duas óticas (gera vs. converte) e o funil fechado
> (ROAS/CAC) é por campanha.

### Tempo de resposta — [`src/metrics/response.ts`](src/metrics/response.ts)

Fonte: **WA**. Para cada conversa, agrupa mensagens por "onda": um bloco de mensagens
**recebidas** seguido da **primeira resposta** do time. Registra o gap
(recebida mais antiga da onda → 1ª resposta). Retorna **mediana** e média. Gaps acima de
**12h** são ignorados (não é resposta real — lead sumiu e voltou). Exibimos a mediana, que
é mais robusta a outliers que a média.

---

## 6. Rastreamento de UTM (como o lead "sabe" o criativo)

1. O anúncio na Meta leva à landing/formulário com UTMs na URL
   (`utm_source`, `utm_campaign`, `utm_content={{ad.name}}` etc.).
2. O formulário grava esses valores em **custom fields do lead** no Kommo. Os IDs desses
   campos ficam em [`CLIENT.campos`](config/client.ts):
   `utm_source`, `utm_campaign`, `utm_content`, `produto`.
3. O sync lê esses campos ([`src/sync/kommo.ts`](src/sync/kommo.ts) → `cf()`) e grava nas
   colunas de UTM do lead.
4. As métricas de origem/criativo/campanha se apoiam nesses valores.

Ou seja: **a atribuição é feita pelo UTM que o próprio lead carrega**, não por estimativa.
Se o lead entrou sem UTM (origem manual, indicação), ele conta em "(sem origem)".

---

## 7. Validações e limitações conhecidas

Transparência sobre o que o número **depende** para estar correto:

- **Reuniões dependem do funil ser movido.** Se o comercial realiza a reunião mas não move
  o card de _Agendado_ para a etapa seguinte, ela não é contada como realizada. A métrica é
  tão fiel quanto a disciplina de mover cards no Kommo.
- **UTM depende da captação.** Origem/criativo/campanha só existem para leads que chegaram
  com UTM preenchido. Leads sem UTM caem em "(sem origem)".
- **"Leads" da Meta (`ad_insights.leads`, `metaResultActions`) segue sincronizado mas não é
  mais exibido** — os painéis de geração/campanha usam contagem de leads do Kommo. O campo
  fica no D1 como referência/backfill, não como métrica do dashboard.
- **Criativo renomeado quebra o cruzamento criativo-a-criativo** (ver §5) — por isso o funil
  fechado é por campanha.
- **Geração de leads por anúncio depende do nome bater.** `ad_name` (Meta) e `utm_content`
  (Kommo, nome do anúncio no clique) precisam coincidir (normalizado); anúncio renomeado ou
  lead sem UTM não aparece no cruzamento por anúncio — mas conta normalmente em "Leads
  gerados" (KPI) e no funil por campanha via `utm_campaign`.
- **Janela de 2h no WhatsApp/Meta.** O "hoje" desses dois pode ter até ~2h de atraso (é a
  cadência do cron). Kommo é ~15 min.
- **Exclusões refletem no próximo sync** via `lead_deleted` (não é instantâneo).
- **Faixas de data (`from`/`to` = YYYY-MM-DD) são calendário local de Brasília**
  ([`src/api/handlers.ts`](src/api/handlers.ts) → `range()`, offset fixo de -3h — Brasil não
  tem horário de verão desde 2019). Os timestamps guardados no D1 continuam em UTC; só a
  conversão do dia pedido pro range de busca leva o offset em conta. Sem isso, o limite do
  dia ficava 3h adiantado e um filtro de 1 dia só (ex. "Ontem") podia perder as mensagens/
  eventos do fim da noite, que caíam no bucket UTC do dia seguinte.

Tudo que é **calculado** tem teste unitário em [`tests/`](tests/) (19 testes). A validação
de que o **dado bruto** está certo é feita conferindo contra o próprio gerenciador da Meta /
Kommo (ex.: gasto e nº de resultados batendo com o painel da Meta).

---

## 8. Replicação para outra operação

Cada cliente é uma **stack isolada** — banco, credenciais e Worker próprios, **não** é
multi-tenant. O repositório é um **template**: todo o motor é genérico e não se toca. Só
**dois pontos** mudam por operação.

**Não muda (o motor):** rotinas de sync das três APIs, todas as fórmulas de métrica, as
migrations do schema, as rotas `/api/*` e o front. É o mesmo código em todos os clientes.

**Muda por operação:**

1. **[`config/client.ts`](config/client.ts)** — o único arquivo com valores da conta:
   - `nome`, `kommoSubdomain`
   - `pipelinesComerciais` (IDs dos funis comerciais)
   - `status` (IDs das etapas: agendado, no-show, cancelado, follow-up, ganho, perdido)
   - `campos` (IDs dos custom fields de UTM e produto)
   - `metaAdAccount`, `metaResultActions` (`action_type` do resultado)
   - `evolutionInstance`, `evolutionUrl`
   - `tema` (logo, cor)
2. **Secrets** da Cloudflare (nunca no git): `KOMMO_TOKEN`, `META_TOKEN`,
   `EVOLUTION_KEY`, `DASH_KEY`, e opcionalmente `ALERT_WEBHOOK_URL` (webhook de
   alerta ativo — Slack/Discord/n8n — ver seção 4).

### Os IDs não são levantados na mão — são lidos da própria API

Etapas, custom fields e evento de resultado têm IDs numéricos que variam por conta. Mas,
**de posse do token**, esses IDs são consultados diretamente nas APIs — não é levantamento
manual do cliente:

- `GET /leads/pipelines` → **etapas** (id + nome).
- `GET /leads/custom_fields` → **campos** de UTM e produto (id + nome).
- Campo `actions` dos `insights` → **evento de resultado** da Meta (`action_type`).

Na prática, quem faz o setup só entrega **credenciais + alguns fatos da conta** (qual funil
é o comercial, quais campos guardam o UTM); o resto é descoberto e preenchido a partir daí.

---

## 9. Do zero, usando o Claude Code (runbook)

Roteiro para quem forka o template e implementa com o **Claude Code** aberto no projeto. A
ideia: reunir os acessos e ir **pedindo** — o Claude conhece o código e consulta as APIs.

### Fase 0 · Tenha em mãos
- Conta **Cloudflare** com `wrangler` autenticado (`wrangler login`).
- **Kommo:** token long-lived + subdomínio.
- **Meta Ads:** token de System User (com `ads_read`) + ID da conta de anúncio.
- **Evolution (WhatsApp):** URL da instância, API key e nome da instância.
- **`DASH_KEY`** forte (senha do painel).
- **Fork** do repositório aberto no Claude Code.

### Fase 1 · Provisionar a stack
> *"Cria o banco D1 desse projeto, atualiza o `wrangler.jsonc` com o `database_id` e roda
> todas as migrations."*

Ele executa `wrangler d1 create`, cola o ID na config e aplica as migrations (schema pronto).

### Fase 2 · Descobrir os IDs (assistido)
Em vez de você caçar identificadores, o Claude consulta as APIs com os tokens e preenche o
`config/client.ts`:

> *"Com este token do Kommo (subdomínio X), lista os pipelines e as etapas com os IDs. Me
> ajuda a marcar qual é o funil comercial e as etapas de agendado, no-show, cancelado,
> follow-up, ganho e perdido."*

> *"Lista os custom fields de lead e diz quais IDs são `utm_source`, `utm_campaign`,
> `utm_content` e o campo de produto."*

> *"Puxa os insights de ontem da conta de anúncio e me diz qual `action_type` corresponde ao
> resultado que a campanha otimiza."*

### Fase 3 · Cadastrar as credenciais
> *"Quais secrets preciso cadastrar, com quais nomes exatos, e como? Me guia."*

Ele lista `KOMMO_TOKEN`, `META_TOKEN`, `EVOLUTION_KEY`, `DASH_KEY` (e, se quiser alerta ativo
de sync, `ALERT_WEBHOOK_URL`) e recomenda cadastrar os tokens longos pelo **painel da
Cloudflare** (o terminal costuma truncar valores grandes).

### Fase 4 · Publicar e carregar o histórico
> *"Faz o build e o deploy, depois dispara o sync manual e acompanha o `sync-log` até
> terminar. Me avisa se algum sync der erro."*

Publica, chama `/api/sync`, lê `/api/sync-log` e reporta ok/erros por fonte. A partir daí o
cron mantém tudo atualizado.

### Fase 5 · Validar contra as fontes
> *"Compara o gasto e o número de resultados do dashboard de ontem com o gerenciador da Meta,
> e a receita com o Kommo. Se algo divergir, investiga e corrige."*

Divergências comuns (evento de resultado errado, campo de UTM trocado) são achadas e
ajustadas na hora.

> **Dica:** descreva *o que* você quer (a métrica, o problema, o número que não bateu), não
> *como* fazer. Quanto mais claro o objetivo, mais direto o Claude resolve.

---

## 10. Segurança

- **Nenhum secret no código.** Tokens ficam como _secrets_ da Cloudflare; `config/client.ts`
  só tem IDs não sensíveis.
- **Toda rota `/api/*` é protegida** por `DASH_KEY` (fail-closed: sem key válida, 401).
- O front guarda a key no navegador após o login e a envia nas chamadas.
- Recomendado: `DASH_KEY` forte por operação e rotação periódica dos tokens.

---

## Versão visual

Existe uma versão web ilustrada desta documentação (com o fluxo de UTM em diagrama e o
runbook), publicada como Artifact para circular com a agência.
