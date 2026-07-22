import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import cron from "node-cron";
import { app } from "./router";
import type { Env } from "./env";
import { createD1 } from "./db/d1-sqlite";
import { runMigrations } from "./db/migrate";
import { runScheduled } from "./sync/orchestrator";

const DB_PATH = process.env.DB_PATH ?? "./data/app.sqlite";
const PORT = Number(process.env.PORT ?? 8787);
// front buildado (Vite). Servido pelo próprio Node — necessário no modo sem Caddy
// (ex.: atrás de um reverse proxy como Traefik). No modo Caddy fica ocioso.
const WEB_DIR = process.env.WEB_DIR ?? "./web/dist";

const db = createD1(DB_PATH);

// env = bindings do Worker montados a partir de process.env
const env: Env = {
  DB: db,
  ASSETS: undefined as any, // não usado no Node (Caddy serve os assets)
  KOMMO_TOKEN: process.env.KOMMO_TOKEN ?? "",
  META_TOKEN: process.env.META_TOKEN ?? "",
  DASH_KEY: process.env.DASH_KEY ?? "",
  EVOLUTION_URL: process.env.EVOLUTION_URL,
  EVOLUTION_KEY: process.env.EVOLUTION_KEY,
  ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
};

// executionCtx que o Hono repassa em c.executionCtx — Node não fornece um.
// waitUntil apenas dispara a promise em background e engole rejeição (paridade
// com o comportamento do Worker, que não derruba o request se a task falha).
const execCtx = {
  waitUntil(p: Promise<unknown>) { Promise.resolve(p).catch(() => {}); },
  passThroughOnException() {},
};

async function main() {
  const n = await runMigrations(db, "migrations");
  console.log(`[boot] migrations aplicadas: ${n}`);

  // Crons: mesmas expressões do Cron Trigger (ver wrangler.jsonc original).
  cron.schedule("*/15 * * * *", () => { void runScheduled(env, "*/15 * * * *"); });
  cron.schedule("0 */2 * * *", () => { void runScheduled(env, "0 */2 * * *"); });

  // App externo: /api/* → API (Hono); resto → front estático com fallback SPA.
  const server = new Hono();
  server.route("/", app); // registra as rotas /api/* (com o gate DASH_KEY)
  server.use("/*", serveStatic({ root: WEB_DIR }));
  server.get("*", serveStatic({ path: `${WEB_DIR}/index.html` })); // fallback SPA

  serve(
    { fetch: (req: Request) => server.fetch(req, env, execCtx as any), port: PORT },
    (info) => console.log(`[boot] servindo API + front em :${info.port}`),
  );
}

main().catch((e) => { console.error("[boot] falhou:", e); process.exit(1); });
