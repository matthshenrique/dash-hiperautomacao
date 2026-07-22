# Deploy do Dashboard em VPS

Guia completo, do zero: registro de DNS → instalação → operação → desinstalação.

Existem **dois modos** de rodar na VPS. Escolha conforme a sua VPS:

- **Modo A — VPS compartilhada (Traefik + Docker Swarm):** a VPS **já tem** um reverse proxy
  Traefik (em Swarm) atendendo as portas 80/443 para outros serviços. O dashboard entra como mais um
  serviço atrás dele. **É o modo validado neste guia.**
- **Modo B — VPS dedicada (Caddy):** a VPS é só pra isso; nada usando 80/443. Um script sobe o
  próprio Caddy com HTTPS automático. Mais simples, coberto no fim.

---

## Índice
1. [Pré-requisitos](#1-pré-requisitos)
2. [Criar o registro DNS](#2-criar-o-registro-dns)
3. [Obter o código (repositório privado)](#3-obter-o-código-repositório-privado)
4. [Preencher o `.env`](#4-preencher-o-env)
5. [Preencher os IDs automaticamente (autoconfig)](#5-preencher-os-ids-automaticamente-autoconfig)
6. [Deploy — Modo A (Traefik/Swarm)](#6-deploy--modo-a-traefikswarm)
7. [Verificar e primeiro sync](#7-verificar-e-primeiro-sync)
8. [Atualizar configuração (cor, nome, tokens…)](#8-atualizar-configuração)
9. [Backup do banco](#9-backup-do-banco)
10. [Desinstalar / reinstalar](#10-desinstalar--reinstalar)
11. [Modo B — VPS dedicada (Caddy)](#11-modo-b--vps-dedicada-caddy)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Pré-requisitos

- **VPS Linux** (Ubuntu/Debian recomendado), **≥ 2 GB RAM** (o build do front consome memória).
- **Docker** + **docker compose v2** ([get.docker.com](https://get.docker.com)).
- Um **domínio** que você controle (para criar o subdomínio do dashboard).
- Credenciais: token do **Kommo**, token da **Meta Ads** e, opcional, **Evolution API** (WhatsApp).
- **Modo A** só: Docker **Swarm** ativo e um **Traefik** já rodando numa rede overlay externa. Você
  informa o nome dessa rede, o entrypoint e o certresolver do seu Traefik no `.env`
  (`TRAEFIK_NETWORK`, `TRAEFIK_ENTRYPOINT`, `TRAEFIK_CERTRESOLVER`) — nada fica fixo no código.

Descubra o IP público da VPS:
```bash
curl -4 ifconfig.me
```

---

## 2. Criar o registro DNS

O dashboard fica num **subdomínio** (ex.: `dashboard.seudominio.com.br`) — assim não afeta seu site
principal. No painel de DNS do seu domínio (Registro.br, Cloudflare DNS, GoDaddy, etc.), crie:

| Tipo | Nome (host) | Valor | TTL |
|------|-------------|-------|-----|
| `A`  | `dashboard` | IP público da VPS | automático |

- O "Nome" é só o prefixo do subdomínio; o provedor completa com o seu domínio.
- **Se o seu DNS é Cloudflare:** deixe o registro como **"DNS only" (nuvem cinza)**, não proxied.
  O Traefik emite o próprio certificado Let's Encrypt; com o proxy laranja ligado, a validação do
  certificado pode falhar.
- Aguarde propagar (segundos a alguns minutos). Confira:
  ```bash
  getent hosts dashboard.seudominio.com.br
  ```
  Deve retornar o IP da VPS.

Anote esse domínio — ele vai em `DASH_DOMAIN` no `.env`.

---

## 3. Obter o código (repositório privado)

O projeto é **público** — clone direto, sem token:
```bash
git clone https://github.com/matthshenrique/dash-hiperautomacao.git
cd dash-hiperautomacao
```

> Se você **forkar** para a sua própria conta, troque a URL pelo seu fork. E se mantiver um fork
> **privado**, clone com um Personal Access Token
> (`git clone https://SEU_TOKEN@github.com/SEU_USUARIO/SEU_REPO.git`) ou uma deploy key.

---

## 4. Preencher o `.env`

Crie o `.env` a partir do exemplo e preencha as credenciais **"semente"** (o resto o autoconfig
preenche no próximo passo):
```bash
cp .env.example .env
nano .env
```

Preencha ao menos:

| Chave | O que é |
|-------|---------|
| `DASH_NAME` | Nome exibido no dashboard. |
| `DASH_COLOR` | Cor primária, hex `#rrggbb`. |
| `DASH_DOMAIN` | O subdomínio do passo 2 (ex.: `dashboard.seudominio.com.br`). |
| `DASH_KEY` | Senha de acesso ao dashboard — escolha uma forte. |
| `KOMMO_SUBDOMAIN` | Subdomínio Kommo (de `minhaconta.kommo.com` → `minhaconta`). |
| `KOMMO_TOKEN` | Token de longa duração da integração Kommo. |
| `META_TOKEN` | Token System User da Meta com escopo `ads_read`. |
| `META_AD_ACCOUNT` | Conta de anúncios **com o prefixo** `act_` (ex.: `act_1234567890`). |

> Onde achar os tokens:
> - **Kommo:** Configurações → Integrações → crie uma integração privada e gere o token de longa duração.
> - **Meta:** [business.facebook.com](https://business.facebook.com) → Usuários do sistema → crie um
>   System User com acesso à conta de anúncios e gere o token com escopo `ads_read`.

**Modo A (Traefik/Swarm):** preencha também, na seção TRAEFIK do `.env`, o `TRAEFIK_NETWORK`,
`TRAEFIK_ENTRYPOINT` e `TRAEFIK_CERTRESOLVER` — os valores do **seu** Traefik. Como descobri-los:

- **`TRAEFIK_NETWORK`** (rede overlay que o Traefik usa): liste as redes e identifique a do Traefik
  (normalmente uma overlay, ex.: `traefik-public`):
  ```bash
  docker network ls
  ```
- **`TRAEFIK_ENTRYPOINT`** e **`TRAEFIK_CERTRESOLVER`**: copie de um serviço web que **já funciona**
  atrás do seu Traefik — as labels revelam os nomes que você usa:
  ```bash
  docker service ls   # veja o nome de um serviço web seu (não o traefik em si)
  docker service inspect NOME_DO_SERVICO --format '{{json .Spec.Labels}}' | tr ',' '\n'
  ```
  Procure `...routers.<algo>.entrypoints` (→ `TRAEFIK_ENTRYPOINT`, ex.: `websecure`) e
  `...routers.<algo>.tls.certresolver` (→ `TRAEFIK_CERTRESOLVER`, ex.: `letsencryptresolver`), e
  `traefik.docker.network` (→ confirma o `TRAEFIK_NETWORK`).

O arquivo `.env` é oculto (começa com ponto). No WinSCP, ative "mostrar ocultos" com `Ctrl+Alt+H`.

---

## 5. Preencher os IDs automaticamente (autoconfig)

Os IDs de pipeline, status e campos do Kommo são preenchidos sozinhos. Rode (num container Node
avulso — não precisa buildar nada; como o diretório está montado, ele escreve no seu `.env`):
```bash
docker run --rm -w /app -v "$PWD":/app node:20-slim node scripts/autoconfig.mjs
```

Ele descobre no Kommo e escreve no `.env`: `KOMMO_PIPELINES`, `STATUS_AGENDADO/NOSHOW/CANCELADO/FOLLOWUP`,
`STATUS_WON`/`STATUS_LOST` (142/143, padrões do Kommo) e `FIELD_UTM_SOURCE/CAMPAIGN/CONTENT/PRODUTO`.

O mapeamento é por **nome** (ex.: um status chamado "Agendado" vira `STATUS_AGENDADO`). O que ele
não conseguir identificar com confiança, ele **avisa** — preencha esses à mão. Para ver a lista
completa de IDs e nomes:
```bash
docker run --rm -w /app -v "$PWD":/app node:20-slim node scripts/discover.mjs
```

Confira o `.env` no fim (`nano .env`).

---

## 6. Deploy — Modo A (Traefik/Swarm)

Com o `.env` completo:
```bash
chmod +x deploy-traefik.sh
./deploy-traefik.sh
```

O script:
1. Confere Docker/Swarm, a rede do Traefik (`TRAEFIK_NETWORK`) e o `.env`.
2. Builda a imagem local `dashboard-hiperautomacao:local` (rodando o `gen-config`, que **valida** o
   `.env` e falha com mensagem clara se faltar/erra algum campo).
3. Sobe o serviço no Swarm, injetando os secrets do `.env` (o Swarm ignora `env_file`, por isso o
   deploy carrega o `.env` e interpola as variáveis).
4. Se o serviço já existia, **força** recriar com a imagem nova (necessário no Swarm: rebuildar com o
   mesmo tag não recria as tasks sozinho).

O Traefik passa a rotear `https://SEU_SUBDOMINIO` → container na porta 8787, com TLS automático
(`SEU_SUBDOMINIO` = o subdomínio que você criou no passo 2, ex.: `dashboard.seudominio.com.br` — **não** o domínio principal).

---

## 7. Verificar e primeiro sync

```bash
docker service ls | grep dashboard          # deve mostrar 1/1 réplica
docker service logs -f dashboard_app         # deve mostrar "migrations aplicadas" e "servindo API + front"
```

Abra `https://SEU_SUBDOMINIO` (o subdomínio do passo 2, ex.: `https://dashboard.seudominio.com.br` —
**não** o domínio principal), faça login com a `DASH_KEY`. Dispare o primeiro sync pelo botão no
dashboard ou abrindo:
```
https://SEU_SUBDOMINIO/api/sync?key=SUA_DASH_KEY
```
Os crons (Kommo a cada 15 min; Meta + Evolution a cada 2 h) rodam sozinhos a partir daí.

---

## 8. Atualizar configuração

Nome, cor, logo e os IDs são **cozidos na imagem** no build; tokens/secrets são injetados no runtime.
Em ambos os casos, o fluxo é o mesmo — edite o `.env` e re-rode o deploy:
```bash
nano .env
./deploy-traefik.sh
```
O deploy rebuilda (pega nome/cor/IDs) e força o serviço a usar a imagem nova (pega os secrets).
Depois, `Ctrl+Shift+R` no navegador para limpar o cache do bundle antigo.

Seus **dados não somem** — o banco fica no volume `dashboard_data`, que persiste entre deploys.

---

## 9. Backup do banco

O banco (SQLite) fica no volume `dashboard_data`. Para um dump manual:
```bash
# descubra o nome real do volume
docker volume ls | grep dashboard
# copie o arquivo do banco para o host
docker run --rm -v dashboard_dashboard_data:/data -v "$PWD":/backup alpine \
  cp /data/app.sqlite /backup/app-$(date +%F).sqlite
```
Agende isso num `cron` do sistema para backups periódicos. O banco é um **cache** reconstruível
(a fonte é Kommo/Meta), mas o resync completo é lento — vale ter backup.

---

## 10. Desinstalar / reinstalar

Confirme o nome do volume com `docker volume ls | grep dashboard` (o Swarm prefixa com o nome do
stack, ex.: `dashboard_dashboard_data`).

- **Desinstalar (mantém o banco):**
  ```bash
  docker stack rm dashboard
  ```

- **Reset só do banco (recomeça do zero, mantém a config):**
  ```bash
  docker stack rm dashboard && sleep 10
  docker volume rm dashboard_dashboard_data
  ./deploy-traefik.sh
  ```

- **Desinstalar tudo (apaga banco + imagem):**
  ```bash
  docker stack rm dashboard && sleep 10
  docker volume rm dashboard_dashboard_data
  docker rmi dashboard-hiperautomacao:local
  ```

- **Reinstalar:** `git pull && ./deploy-traefik.sh`.

> O `sleep 10` existe porque `docker stack rm` é assíncrono: o volume só sai depois que as tasks do
> serviço realmente caem. Se `docker volume rm` reclamar que está em uso, espere mais e repita.

---

## 11. Modo B — VPS dedicada (Caddy)

Se a VPS **não tem** proxy nenhum ocupando 80/443, use o instalador com Caddy embutido (TLS
automático, sem Swarm):

1. Passos 2 a 5 iguais (DNS, clone, `.env`, autoconfig — mas rode o autoconfig via
   `docker compose run --rm app node scripts/autoconfig.mjs` após o primeiro build, ou pelo container
   avulso como no passo 5).
2. Deploy:
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
   Ele faz preflight (Docker, portas 80/443 livres, DNS, RAM), builda, sobe `app` + `caddy`
   (+ `litestream` se configurado), roda as migrations, healthcheck e o primeiro sync.
3. Atualizar: `git pull && ./install.sh`. Backup opcional contínuo via `LITESTREAM_*` no `.env`.

Este modo **não** funciona se já houver outro serviço nas portas 80/443 — nesse caso use o Modo A.

---

## 12. Troubleshooting

| Sintoma | Causa / solução |
|--------|-----------------|
| `porta 80 já em uso` (no `install.sh`) | Você tem um proxy (Traefik) na VPS → use o **Modo A**, não o `install.sh`. |
| `Swarm não está ativo` mesmo com Swarm rodando | Versão antiga do `deploy-traefik.sh`. Rode `git pull`. Contorno: rode os comandos do deploy na mão. |
| `config inválida` no build | O `gen-config` lista a chave exata faltando/errada no `.env`. Corrija e re-rode. |
| `META_AD_ACCOUNT deve começar com "act_"` | Faltou o prefixo — use `act_1234567890`. |
| Mudei cor/nome mas não aparece | Cache do navegador (`Ctrl+Shift+R`) ou serviço na imagem antiga — `git pull` traz o deploy que já força o update; ou force à mão: `docker service update --image dashboard-hiperautomacao:local --force dashboard_app`. |
| Certificado não emite (HTTPS falha) | O `DASH_DOMAIN` tem que resolver para a VPS **antes** do deploy. Se DNS é Cloudflare, deixe "DNS only" (cinza). |
| `git clone` pede senha / nega | Repo é privado — use PAT ou deploy key (passo 3). |
| Autoconfig não achou um status/campo | O nome no Kommo foge do padrão — rode o `discover`, pegue o ID e preencha à mão no `.env`. |
| API não responde | `docker service logs dashboard_app` (Modo A) ou `docker compose logs app` (Modo B) mostra o erro de boot. |
| Build falha por memória | VPS com pouca RAM — adicione swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`. |
