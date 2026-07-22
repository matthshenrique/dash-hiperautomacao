#!/usr/bin/env bash
# Deploy do dashboard no modo VPS compartilhada com Traefik (Docker Swarm).
# Builda a imagem local e sobe o stack, injetando o .env (Swarm não lê env_file).
set -euo pipefail

err() { echo "✗ $*" >&2; }
ok()  { echo "✓ $*"; }
info(){ echo "→ $*"; }

STACK_NAME="${STACK_NAME:-dashboard}"
IMAGE="dashboard-hiperautomacao:local"

# 1. pré-checagens
command -v docker >/dev/null 2>&1 || { err "Docker não instalado."; exit 1; }
[ "$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null)" = "active" ] || { err "Swarm não está ativo. Rode: docker swarm init"; exit 1; }
[ -f .env ] || { err ".env não encontrado. Copie .env.example para .env e preencha."; exit 1; }

# 2. carrega o .env (secrets + DASH_DOMAIN + config do Traefik) pro ambiente,
# p/ interpolação do stack
set -a; . ./.env; set +a
[ -n "${DASH_DOMAIN:-}" ] || { err "DASH_DOMAIN vazio no .env."; exit 1; }
[ -n "${TRAEFIK_NETWORK:-}" ] || { err "TRAEFIK_NETWORK vazio no .env (nome da rede overlay do seu Traefik)."; exit 1; }
[ -n "${TRAEFIK_ENTRYPOINT:-}" ] || { err "TRAEFIK_ENTRYPOINT vazio no .env (ex.: websecure)."; exit 1; }
[ -n "${TRAEFIK_CERTRESOLVER:-}" ] || { err "TRAEFIK_CERTRESOLVER vazio no .env (ex.: letsencryptresolver)."; exit 1; }
docker network inspect "$TRAEFIK_NETWORK" >/dev/null 2>&1 || { err "rede overlay '$TRAEFIK_NETWORK' não existe (é a rede do seu Traefik)."; exit 1; }

# 3. builda a imagem (roda gen-config: valida o .env e gera config/client.ts)
info "buildando imagem $IMAGE (valida o .env)…"
if ! docker build --build-arg BUILD_ENV_FILE=.env -t "$IMAGE" .; then
  err "build falhou — provável campo faltando/ inválido no .env (veja o gen-config acima)."
  exit 1
fi

# 4. sobe o stack (interpola ${VARS} do .env já carregado)
# checa se o serviço já existe ANTES do deploy (p/ decidir se precisa forçar update)
SVC_EXISTIA=0
docker service inspect "${STACK_NAME}_app" >/dev/null 2>&1 && SVC_EXISTIA=1

info "subindo o stack '$STACK_NAME'…"
docker stack deploy -c stack.traefik.yml "$STACK_NAME" --with-registry-auth

# No Swarm, rebuildar com o mesmo tag (:local) não recria as tasks — a spec do
# serviço não muda. Se o serviço já existia, força recriar com a imagem nova.
if [ "$SVC_EXISTIA" = "1" ]; then
  info "forçando o serviço a usar a imagem recém-buildada…"
  docker service update --image "$IMAGE" --force "${STACK_NAME}_app" >/dev/null
fi

ok "deploy enviado. O Traefik vai rotear https://${DASH_DOMAIN} → app:8787."
echo "  Status:  docker service ls | grep ${STACK_NAME}"
echo "  Logs:    docker service logs -f ${STACK_NAME}_app"
echo "  1º sync: abra https://${DASH_DOMAIN}/api/sync?key=SUA_DASH_KEY (ou o botão no dash)"
