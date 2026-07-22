#!/usr/bin/env bash
set -euo pipefail

err()  { echo "✗ $*" >&2; }
ok()   { echo "✓ $*"; }
info() { echo "→ $*"; }

# 1. PRÉ-FLIGHT ------------------------------------------------------------
info "checando pré-requisitos…"
command -v docker >/dev/null 2>&1 || { err "Docker não instalado. Veja INSTALL.md (seção Requisitos)."; exit 1; }
docker compose version >/dev/null 2>&1 || { err "'docker compose' (plugin v2) ausente. Atualize o Docker."; exit 1; }

for p in 80 443; do
  if (command -v ss >/dev/null && ss -ltn "sport = :$p" | grep -q ":$p") 2>/dev/null; then
    err "porta $p já em uso. Libere-a (outro webserver?) antes de instalar."; exit 1
  fi
done

TOTAL_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo 0)
if [ "${TOTAL_MB:-0}" -lt 1800 ]; then
  err "RAM ${TOTAL_MB}MB < 2GB. O build do front pode falhar. Adicione swap ou use uma VPS maior."
  echo "  (para continuar mesmo assim: INSTALL_FORCE=1 ./install.sh)"
  [ "${INSTALL_FORCE:-0}" = "1" ] || exit 1
fi

# 2. .ENV -----------------------------------------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  err ".env criado a partir de .env.example. Preencha-o e rode de novo."
  echo "  Dica: rode a descoberta de IDs com:  docker compose run --rm app node scripts/discover.mjs"
  exit 1
fi

# carrega DASH_DOMAIN para o Caddyfile
set -a; . ./.env; set +a
[ -n "${DASH_DOMAIN:-}" ] || { err "DASH_DOMAIN vazio no .env (domínio do dashboard)."; exit 1; }

# 3. DNS check (aviso, não bloqueia) --------------------------------------
if command -v getent >/dev/null; then
  IP_LOCAL=$(curl -fsS https://api.ipify.org 2>/dev/null || echo "")
  IP_DNS=$(getent hosts "$DASH_DOMAIN" | awk '{print $1}' | head -1 || echo "")
  if [ -n "$IP_LOCAL" ] && [ -n "$IP_DNS" ] && [ "$IP_LOCAL" != "$IP_DNS" ]; then
    err "DASH_DOMAIN ($DASH_DOMAIN → $IP_DNS) não aponta para este servidor ($IP_LOCAL)."
    echo "  Ajuste o DNS (registro A) — sem isso o TLS do Caddy falha. (Aviso; continuando em 5s)"; sleep 5
  fi
fi

# 4. GERA O CADDYFILE ------------------------------------------------------
DASH_DOMAIN="$DASH_DOMAIN" envsubst '$DASH_DOMAIN' < Caddyfile.template > Caddyfile
ok "Caddyfile gerado para $DASH_DOMAIN"

# se houver backup configurado, materializa litestream.yml e liga o profile
COMPOSE_PROFILES=""
if [ -n "${LITESTREAM_BUCKET:-}" ]; then
  envsubst < litestream.yml.template > litestream.yml
  COMPOSE_PROFILES="backup"
  ok "backup (Litestream) configurado para bucket $LITESTREAM_BUCKET"
fi

# 5. BUILD + VALIDAÇÃO DA CONFIG ------------------------------------------
info "buildando a imagem (valida o .env via gen-config)…"
if ! docker compose build; then
  err "build falhou. Causa comum: campo faltando/ inválido no .env (veja a mensagem do gen-config acima)."
  exit 1
fi

# extrai o front buildado da imagem p/ o Caddy servir
info "extraindo front estático…"
CID=$(docker create "$(docker compose config --images | head -1)")
rm -rf web-dist && mkdir -p web-dist
docker cp "$CID:/app/web/dist/." web-dist/
docker rm "$CID" >/dev/null

# 6. SOBE -----------------------------------------------------------------
info "subindo os serviços…"
COMPOSE_PROFILES="$COMPOSE_PROFILES" docker compose up -d

# 7. HEALTHCHECK ----------------------------------------------------------
info "aguardando a API responder…"
for i in $(seq 1 30); do
  if docker compose exec -T app node -e "fetch('http://localhost:8787/api/sync-log?key='+process.env.DASH_KEY).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    ok "API no ar."
    break
  fi
  [ "$i" = "30" ] && { err "API não respondeu. Veja: docker compose logs app"; exit 1; }
  sleep 2
done

# 8. SYNC INICIAL ---------------------------------------------------------
info "disparando sync inicial…"
docker compose exec -T app node -e "fetch('http://localhost:8787/api/sync?key='+process.env.DASH_KEY).catch(()=>{})" || true

ok "instalação concluída. Acesse: https://${DASH_DOMAIN}"
echo "  Logs:   docker compose logs -f app"
echo "  Update: git pull && ./install.sh"
