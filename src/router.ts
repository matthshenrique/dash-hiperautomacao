import { Hono } from "hono";
import type { Env } from "./env";
import * as h from "./api/handlers";
import { syncKommo, syncMeta, syncEvolution } from "./sync/orchestrator";

export const app = new Hono<{ Bindings: Env }>();

// gate por DASH_KEY em todas as rotas /api
app.use("/api/*", async (c, next) => {
  const key = c.req.query("key") ?? c.req.header("x-dash-key");
  // Falha fechado: se o secret não estiver setado, nega tudo (não vira API pública).
  if (!c.env.DASH_KEY || key !== c.env.DASH_KEY) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

const url = (c: any) => new URL(c.req.url);
// Endpoint consolidado: substitui as 6 chamadas abaixo numa carga de tela única,
// reaproveitando as mesmas queries base do D1 (ver src/api/handlers.ts:dashboard).
app.get("/api/dashboard", (c) => h.dashboard(c.env, url(c)).then((r) => c.json(r)));
app.get("/api/overview", (c) => h.overview(c.env, url(c)).then((r) => c.json(r)));
app.get("/api/funnel", (c) => h.funnel(c.env, url(c)).then((r) => c.json(r)));
app.get("/api/meetings", (c) => h.meetings(c.env, url(c)).then((r) => c.json(r)));
app.get("/api/revenue", (c) => h.revenue(c.env, url(c)).then((r) => c.json(r)));
app.get("/api/creatives", (c) => h.creatives(c.env, url(c)).then((r) => c.json(r)));
app.get("/api/response", (c) => h.responseTime(c.env, url(c)).then((r) => c.json(r)));
app.get("/api/goals", (c) => h.getGoal(c.env, url(c)).then((r) => c.json(r)));
app.post("/api/goals", async (c) => {
  try {
    const body = await c.req.json();
    return c.json(await h.saveGoal(c.env, body));
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 400);
  }
});

// Gatilho manual de sync (gateado por DASH_KEY). Por padrão roda a Meta em modo
// incremental (mais rápido); passe ?full=true pra forçar o backfill de 90 dias.
// Tem cooldown (ver checkManualSyncCooldown) pra não deixar disparar em excesso.
// Dispara em background e retorna na hora; acompanhe o resultado em /api/sync-log.
app.get("/api/sync", async (c) => {
  const full = c.req.query("full") === "true";
  const cooldown = await h.checkManualSyncCooldown(c.env, full);
  if (cooldown.blocked) {
    return c.json({ started: false, retryInSec: cooldown.retryInSec }, 429);
  }
  c.executionCtx.waitUntil(
    Promise.allSettled([syncKommo(c.env), syncMeta(c.env, full), syncEvolution(c.env)]),
  );
  return c.json({ started: true, full });
});

app.get("/api/sync-status", (c) => h.syncStatus(c.env).then((r) => c.json(r)));

app.get("/api/sync-log", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT source, status, rows, error, finished_at FROM sync_log " +
    "ORDER BY id DESC LIMIT 5",
  ).all();
  return c.json(results);
});
