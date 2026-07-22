# Dashboard Comercial (self-hosted)

Dashboard de métricas comerciais (Kommo + Meta Ads + WhatsApp/Evolution). Cada instalação é
independente e personalizada via `.env`. Roda em Cloudflare Workers ou na sua própria VPS.

## Como implantar (dois modos)

- **Cloudflare Workers** (serverless, sem servidor pra manter — recomendado p/ a maioria): veja [DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md).
- **VPS própria** (Docker, auto-hospedagem com posse total da infra): veja [INSTALL.md](INSTALL.md).

O código de negócio é o mesmo nos dois; muda só o runtime (entrypoint + banco).

## Operação (VPS)

- **Logs:** `docker compose logs -f app`
- **Atualizar:** `git pull && ./install.sh`
- **Sync manual:** acesse `https://SEU_DOMINIO/api/sync?key=SUA_DASH_KEY` (ou o botão no dashboard).
- **Backup:** configure as chaves `LITESTREAM_*` no `.env` para replicação contínua do SQLite.
- **Restaurar backup:** `litestream restore -o data/app.sqlite <replica-url>` (ver docs do Litestream).

## Arquitetura

Node + Hono servindo `/api/*`, SQLite local (`data/app.sqlite`), crons internas (Kommo a cada
15 min; Meta + Evolution a cada 2 h). Caddy faz proxy e TLS. Sem dependência de nuvem específica.
