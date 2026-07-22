# ---- builder: instala deps, gera config, builda o front ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app
# build tools p/ compilar o binário nativo do better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# gera config/client.ts a partir do .env montado no build (ver compose: args).
# usa tsx (devDep) via scripts/gen-config.mjs — por isso roda no builder.
ARG BUILD_ENV_FILE=.env
RUN ENV_FILE=${BUILD_ENV_FILE} node scripts/gen-config.mjs
RUN npm run build:web

# ---- runtime: só o necessário pra rodar ----
# Reusa node_modules do builder (mesma base/plataforma) — traz o binário nativo
# do better-sqlite3 já compilado e o tsx, sem recompilar nem precisar de toolchain.
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/config ./config
COPY --from=builder /app/src ./src
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/web/dist ./web/dist
EXPOSE 8787
CMD ["npx", "tsx", "src/server.ts"]
