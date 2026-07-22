# Deploy na Cloudflare (Workers + D1)

Alternativa ao VPS: rodar o dashboard na **Cloudflare Workers** (serverless, sem servidor
pra manter, sem porta/TLS/proxy). Dentro do plano **gratuito** para uma operação deste porte.

> **Aviso de honestidade:** a parte mais difícil não é a Cloudflare — é **obter as credenciais
> e IDs** do Kommo e da Meta (passos 6–8). Isso é igual em qualquer plataforma. Se a pessoa que
> vai instalar não tem familiaridade com terminal, o caminho mais tranquilo é **alguém técnico
> fazer o deploy uma vez** e entregar a URL pronta.

---

## Requisitos

- Conta **gratuita** no [GitHub](https://github.com) (para clonar o repositório).
- Conta **gratuita** na [Cloudflare](https://dash.cloudflare.com/sign-up) (Workers + D1 grátis).
- **Node.js 20+** instalado ([nodejs.org](https://nodejs.org)) — necessário para o `wrangler` (CLI da Cloudflare).
- Credenciais: token do **Kommo**, token da **Meta Ads** e, opcional, **Evolution API** (WhatsApp).

> Só as duas contas grátis **não bastam**: o deploy usa o terminal (`wrangler`). Se quiser um
> caminho sem terminal, veja a seção "Deploy sem terminal" no final.

---

## Visão geral

1. Clonar → 2. Instalar deps → 3. Login na Cloudflare → 4. Criar o banco D1 →
5. Migrar → 6. Descobrir os IDs → 7. Gerar a config → 8. Definir os secrets →
9. Deploy → 10. Acessar.

---

## Passo 1 — Clonar o repositório
```bash
git clone https://github.com/matthshenrique/dash-hiperautomacao.git
cd dash-hiperautomacao
```

## Passo 2 — Instalar dependências
```bash
npm install
```

## Passo 3 — Login na Cloudflare
```bash
npx wrangler login
```
Abre o navegador para autorizar. Uma vez só por máquina.

## Passo 4 — Criar o banco D1
```bash
npx wrangler d1 create dashboard-db
```
O comando devolve um bloco com um `database_id`. **Copie esse id** e cole em
[`wrangler.jsonc`](wrangler.jsonc), no campo `"database_id": "PREENCHA_SEU_DATABASE_ID"`.

## Passo 5 — Rodar as migrations (cria as tabelas no D1)
```bash
npx wrangler d1 migrations apply dashboard-db --remote
```

## Passo 6 — Descobrir os IDs do Kommo/Meta
Copie o exemplo de configuração e preencha ao menos `KOMMO_SUBDOMAIN`, `KOMMO_TOKEN` e `META_TOKEN`:
```bash
cp .env.example .env
# edite o .env e preencha esses três campos
node scripts/discover.mjs
```
O comando lista **pipelines, status, campos custom** (Kommo) e **contas de anúncio** (Meta) com
seus IDs. Copie os que interessam para o `.env` (campos `KOMMO_PIPELINES`, `STATUS_*`, `FIELD_*`,
`META_AD_ACCOUNT`). Preencha também `DASH_NAME`, `DASH_COLOR` e `META_RESULT_ACTIONS`.

> Onde achar os tokens:
> - **Kommo:** Configurações → Integrações → crie uma integração privada e gere um token de longa duração.
> - **Meta:** [business.facebook.com](https://business.facebook.com) → Usuários do sistema → crie um
>   System User com acesso à conta de anúncios e gere um token com escopo `ads_read`.

## Passo 7 — Gerar a config do cliente
```bash
npm run gen:config
```
Lê o `.env`, valida e gera `config/client.ts` (só dados **não-secretos** — nome, cor, IDs). Se algo
estiver faltando/inválido, ele aponta a chave exata. Os **secrets** vão no próximo passo.

## Passo 8 — Definir os secrets (não vão no código)
```bash
npx wrangler secret put KOMMO_TOKEN
npx wrangler secret put META_TOKEN
npx wrangler secret put DASH_KEY          # senha de acesso ao dashboard (escolha uma forte)
# opcionais:
npx wrangler secret put EVOLUTION_KEY
npx wrangler secret put ALERT_WEBHOOK_URL
```
Cada comando pede o valor e guarda criptografado na Cloudflare (nunca fica no repositório).

## Passo 9 — Build do front + deploy
```bash
npm run cf:deploy
```
(Equivale a `gen:config` + build do React + `wrangler deploy`.) Ao final, o wrangler mostra a URL
`https://dashboard-comercial.<sua-conta>.workers.dev`.

## Passo 10 — Acessar e sincronizar
Abra a URL, faça login com a `DASH_KEY`. Dispare o primeiro sync abrindo:
```
https://SUA_URL/api/sync?key=SUA_DASH_KEY
```
(ou pelo botão de sync no dashboard). Os crons (Kommo 15min, Meta+Evolution 2h) rodam sozinhos daí.

---

## Atualizar depois
```bash
git pull
npm run cf:deploy
```

## Custo e limites (plano grátis)
- **Workers:** 100 mil requisições/dia grátis — folga enorme para um dashboard interno.
- **D1:** 5 GB de armazenamento e milhões de leituras/dia grátis.
- **Cron Triggers:** inclusos.
Uma operação deste porte roda **sem custo**.

## Troubleshooting
- **`database_id` inválido / tabela não existe** → confirme o passo 4 (colar o id) e o passo 5 (migrations).
- **`config inválida` no gen:config** → o comando lista a chave exata faltando no `.env`; corrija e rode de novo.
- **401 unauthorized no dashboard** → a `DASH_KEY` do secret (passo 8) tem que bater com a que você digita.
- **Sync com erro** → veja `https://SUA_URL/api/sync-log?key=SUA_DASH_KEY`; normalmente é token do Kommo/Meta expirado.

---

## Deploy assistido por Claude Code (para não-técnicos)

Se você não tem familiaridade com terminal, dá para deixar o **Claude Code** (agente de IA da
Anthropic que roda no terminal) executar os passos por você — você só responde as perguntas e
aprova as ações.

Como fazer:
1. Instale o Claude Code seguindo [claude.com/claude-code](https://claude.com/claude-code) (precisa de
   uma conta Anthropic) e o **Node.js 20+**.
2. Clone o projeto e abra a pasta:
   ```bash
   git clone https://github.com/matthshenrique/dash-hiperautomacao.git
   cd dash-hiperautomacao
   claude
   ```
3. Peça, em português mesmo, algo como:
   > "Siga o passo a passo do arquivo DEPLOY-CLOUDFLARE.md e faça o deploy na Cloudflare. Vá me
   > perguntando os tokens e dados quando precisar, e me explique cada passo."
4. O Claude Code vai rodar os comandos (`wrangler login`, criar o D1, migrations, `secret put`,
   deploy), **pedindo sua aprovação** antes de cada ação e solicitando os valores (tokens, IDs) na hora.

O que ele **não** faz por você (é seu, em qualquer cenário):
- Criar as contas (GitHub, Cloudflare) e **gerar os tokens** do Kommo e da Meta — esses você obtém
  nos painéis (passos 6–8). O Claude Code te guia onde clicar, mas quem tem acesso às contas é você.
- Aprovar as ações no terminal e no navegador (login da Cloudflare abre o browser).

É a forma mais amigável de rodar os passos 1–9 sem decorar comando nenhum.

## Deploy sem terminal (para não-técnicos)
A Cloudflare tem a integração **"Connect to Git"** / **Workers Builds**: no painel da Cloudflare,
você conecta o repositório do GitHub e ela builda e faz o deploy automaticamente a cada push. Nesse
modo:
- o **banco D1** e os **secrets** são configurados pela **interface web** (sem `wrangler`);
- ainda é preciso **obter os tokens/IDs** (passos 6–8) — isso não tem como automatizar.

É o caminho mais próximo de "clonar e implantar" sem linha de comando, mas exige configurar o build
uma vez no painel. Para a maioria dos casos, o mais simples continua sendo alguém técnico rodar os
passos 1–9 uma vez e entregar a URL pronta.
