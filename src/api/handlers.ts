import type { Env } from "../env";
import { CLIENT } from "../../config/client";
import { computeOverview } from "../metrics/overview";
import { computeFunnel, computeLossReasons } from "../metrics/funnel";
import { computeMeetings } from "../metrics/meetings";
import { revenueByStatus, revenueByOrigin, productStats } from "../metrics/revenue";
import { creativesGeneration, creativesConversion, campaignsUnified } from "../metrics/creatives";
import { avgResponseTime } from "../metrics/response";

// America/Sao_Paulo = UTC-3 fixo (sem horário de verão desde 2019).
const BR_OFFSET_SEC = 3 * 3600;

// range em unix a partir de query; default = mês atual.
// from/to (YYYY-MM-DD) vêm do front como dia de calendário LOCAL (Brasil), não
// UTC — por isso somamos o offset: "00:00 local" é "03:00 UTC" do mesmo dia.
// Sem isso, o limite do dia fica 3h adiantado e faixas de 1 dia só ("Ontem")
// perdem as últimas mensagens/eventos da noite, que caem no bucket UTC de
// "hoje" — ex.: tempo de resposta zerado num dia que teve conversas à noite.
// Exportado só pra teste unitário (tests/api/range.test.ts) — é aqui que
// viveram dois bugs reais: filtro usando UTC puro (perdia a virada do dia) e
// duplicidade de investido (fromYmd/toYmd derivados errado do epoch ajustado).
export function range(url: URL): {
  fromU: number; toU: number; month: string; fromYmd: string; toYmd: string;
} {
  const now = new Date();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const fromYmd = from ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const toYmd = to ?? now.toISOString().slice(0, 10);
  const fromU = Math.floor(new Date(fromYmd + "T00:00:00Z").getTime() / 1000) + BR_OFFSET_SEC;
  // sem "to" explícito, mantém "agora" (instante atual) em vez de fim do dia.
  const toU = to
    ? Math.floor(new Date(toYmd + "T23:59:59Z").getTime() / 1000) + BR_OFFSET_SEC
    : Math.floor(now.getTime() / 1000);
  return { fromU, toU, month: fromYmd.slice(0, 7), fromYmd, toYmd };
}

const pipes = CLIENT.pipelinesComerciais;
const placeholders = pipes.map(() => "?").join(",");

const LEAD_COLUMNS = `status_id, price, created_at, closed_at, loss_reason, produto,
            utm_source, utm_content, utm_campaign`;

// Leads CRIADOS no período — base de "leads gerados" e das etapas em aberto do funil.
async function leadsCreatedInRange(env: Env, fromU: number, toU: number) {
  const { results } = await env.DB.prepare(
    `SELECT ${LEAD_COLUMNS}
     FROM leads
     WHERE pipeline_id IN (${placeholders})
       AND created_at BETWEEN ? AND ?`,
  ).bind(...pipes, fromU, toU).all();
  return results as any[];
}

// Leads FECHADOS (ganho/perdido) no período por closed_at — é o filtro "Fechado" do
// Kommo. Pode incluir leads criados fora do período informado.
async function leadsClosedInRange(env: Env, fromU: number, toU: number) {
  const { results } = await env.DB.prepare(
    `SELECT ${LEAD_COLUMNS}
     FROM leads
     WHERE pipeline_id IN (${placeholders})
       AND status_id IN (?, ?)
       AND closed_at BETWEEN ? AND ?`,
  ).bind(...pipes, CLIENT.status.won, CLIENT.status.lost, fromU, toU).all();
  return results as any[];
}

async function spendInRange(env: Env, fromYmd: string, toYmd: string) {
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(spend),0) s FROM ad_insights WHERE date BETWEEN ? AND ?",
  ).bind(fromYmd, toYmd).first<{ s: number }>();
  return row?.s ?? 0;
}

export async function overview(env: Env, url: URL) {
  const { fromU, toU, month, fromYmd, toYmd } = range(url);
  const [created, closed] = await Promise.all([
    leadsCreatedInRange(env, fromU, toU),
    leadsClosedInRange(env, fromU, toU),
  ]);
  // ad_insights.date é string de calendário (sem hora) — usa fromYmd/toYmd
  // direto. Reconverter fromU/toU (que já têm o offset BR somado) de volta
  // pra string via toISOString() empurra "toU" pro dia seguinte em UTC e
  // duplica o gasto de hoje na consulta de "ontem".
  const spend = await spendInRange(env, fromYmd, toYmd);
  const goal = await env.DB.prepare(
    "SELECT goal_revenue, goal_leads FROM meta_goals WHERE month = ?",
  ).bind(month).first<{ goal_revenue: number; goal_leads: number }>();
  return computeOverview(created.length, closed, spend, goal ?? null);
}

export async function funnel(env: Env, url: URL) {
  const { fromU, toU } = range(url);
  const [created, closed] = await Promise.all([
    leadsCreatedInRange(env, fromU, toU),
    leadsClosedInRange(env, fromU, toU),
  ]);
  return { funnel: computeFunnel(created, closed), lossReasons: computeLossReasons(closed) };
}

export async function meetings(env: Env, url: URL) {
  const { fromU, toU } = range(url);
  const { results } = await env.DB.prepare(
    "SELECT lead_id, status_before, status_after FROM lead_events " +
    "WHERE created_at BETWEEN ? AND ?",
  ).bind(fromU, toU).all();
  return computeMeetings(results as any[]);
}

export async function revenue(env: Env, url: URL) {
  const { fromU, toU } = range(url);
  const closed = await leadsClosedInRange(env, fromU, toU);
  const { results: st } = await env.DB.prepare(
    "SELECT id, name FROM crm_statuses",
  ).all<{ id: number; name: string }>();
  const names = new Map(st.map((s) => [s.id, s.name]));
  return {
    byStatus: revenueByStatus(closed, names),
    byOrigin: revenueByOrigin(closed),
    products: productStats(closed),
  };
}

export async function creatives(env: Env, url: URL) {
  const { fromU, toU, fromYmd, toYmd } = range(url);
  const { results: ins } = await env.DB.prepare(
    "SELECT ad_id, ad_name, campaign_name, spend FROM ad_insights WHERE date BETWEEN ? AND ?",
  ).bind(fromYmd, toYmd).all();
  const [created, closed] = await Promise.all([
    leadsCreatedInRange(env, fromU, toU),
    leadsClosedInRange(env, fromU, toU),
  ]);
  const won = closed.filter((l) => l.status_id === CLIENT.status.won);
  return {
    generation: creativesGeneration(ins as any[], created),
    conversion: creativesConversion(won),
    campaigns: campaignsUnified(ins as any[], created, won),
  };
}

export async function responseTime(env: Env, url: URL) {
  const { fromU, toU } = range(url);
  const { results } = await env.DB.prepare(
    "SELECT chat, from_me, ts FROM wa_messages WHERE ts BETWEEN ? AND ?",
  ).bind(fromU, toU).all();
  return avgResponseTime(results as any[]);
}

// Cooldown do sync manual (/api/sync), pra ninguém (sem querer ou não) ficar
// forçando sync em excesso. Reaproveita a tabela sync_state (já existe, guarda
// cursor por fonte) com chaves próprias — sem migration nova. Incremental
// (uso comum, já é barato) tem cooldown curto; full=true (backfill de 90 dias
// na Meta, caro) tem cooldown bem maior.
const MANUAL_COOLDOWN_SEC = 5 * 60;
const MANUAL_FULL_COOLDOWN_SEC = 60 * 60;

export async function checkManualSyncCooldown(
  env: Env, full: boolean,
): Promise<{ blocked: boolean; retryInSec: number }> {
  const key = full ? "manual_sync_full" : "manual_sync";
  const cooldownSec = full ? MANUAL_FULL_COOLDOWN_SEC : MANUAL_COOLDOWN_SEC;
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    "SELECT last_synced_at FROM sync_state WHERE source = ?",
  ).bind(key).first<{ last_synced_at: number }>();
  const elapsed = now - (row?.last_synced_at ?? 0);
  if (elapsed < cooldownSec) return { blocked: true, retryInSec: cooldownSec - elapsed };
  await env.DB.prepare(
    "INSERT INTO sync_state (source, last_synced_at) VALUES (?, ?) " +
    "ON CONFLICT(source) DO UPDATE SET last_synced_at = excluded.last_synced_at",
  ).bind(key, now).run();
  return { blocked: false, retryInSec: 0 };
}

// Endpoint consolidado: roda cada query base do D1 UMA única vez e devolve, num
// único JSON, as mesmas seções que /api/overview, /api/funnel, /api/meetings,
// /api/revenue, /api/creatives e /api/response retornam hoje — evita repetir
// leadsCreatedInRange/leadsClosedInRange/ad_insights etc. 6x por carga de tela.
export async function dashboard(env: Env, url: URL) {
  const { fromU, toU, month, fromYmd, toYmd } = range(url);

  const [created, closed, spend, goal, statusRows, insRows, eventRows, msgRows] =
    await Promise.all([
      leadsCreatedInRange(env, fromU, toU),
      leadsClosedInRange(env, fromU, toU),
      spendInRange(env, fromYmd, toYmd),
      env.DB.prepare(
        "SELECT goal_revenue, goal_leads FROM meta_goals WHERE month = ?",
      ).bind(month).first<{ goal_revenue: number; goal_leads: number }>(),
      env.DB.prepare("SELECT id, name FROM crm_statuses").all<{ id: number; name: string }>(),
      env.DB.prepare(
        "SELECT ad_id, ad_name, campaign_name, spend FROM ad_insights WHERE date BETWEEN ? AND ?",
      ).bind(fromYmd, toYmd).all(),
      env.DB.prepare(
        "SELECT lead_id, status_before, status_after FROM lead_events " +
        "WHERE created_at BETWEEN ? AND ?",
      ).bind(fromU, toU).all(),
      env.DB.prepare(
        "SELECT chat, from_me, ts FROM wa_messages WHERE ts BETWEEN ? AND ?",
      ).bind(fromU, toU).all(),
    ]);

  const ins = insRows.results as any[];
  const names = new Map(statusRows.results.map((s) => [s.id, s.name]));
  const won = closed.filter((l) => l.status_id === CLIENT.status.won);

  return {
    overview: computeOverview(created.length, closed, spend, goal ?? null),
    funnel: { funnel: computeFunnel(created, closed), lossReasons: computeLossReasons(closed) },
    meetings: computeMeetings(eventRows.results as any[]),
    revenue: {
      byStatus: revenueByStatus(closed, names),
      byOrigin: revenueByOrigin(closed),
      products: productStats(closed),
    },
    creatives: {
      generation: creativesGeneration(ins, created),
      conversion: creativesConversion(won),
      campaigns: campaignsUnified(ins, created, won),
    },
    response: avgResponseTime(msgRows.results as any[]),
  };
}

// Último registro de sync POR FONTE (kommo/meta/evolution). Diferente de
// /api/sync-log (últimas 5 no geral): como o Kommo roda a cada 15 min, ele
// sozinho ocuparia as 5 posições e escondería Meta/Evolution (que rodam a
// cada 2h) — aqui cada fonte aparece sempre, mesmo que só uma tenha rodado.
export async function syncStatus(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT source, status, rows, error, finished_at FROM sync_log
     WHERE id IN (SELECT MAX(id) FROM sync_log GROUP BY source)`,
  ).all();
  return results;
}

// GET meta do mês (YYYY-MM); default = mês atual
export async function getGoal(env: Env, url: URL) {
  const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const row = await env.DB.prepare(
    "SELECT month, goal_revenue, goal_leads FROM meta_goals WHERE month = ?",
  ).bind(month).first();
  return row ?? { month, goal_revenue: 0, goal_leads: 0 };
}

// POST salva/atualiza a meta de um mês
export async function saveGoal(env: Env, body: any) {
  const month = String(body?.month ?? "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("month inválido (YYYY-MM)");
  const revenue = Math.max(0, Math.round(Number(body?.goal_revenue ?? 0)));
  const leads = Math.max(0, Math.round(Number(body?.goal_leads ?? 0)));
  await env.DB.prepare(
    "INSERT INTO meta_goals (month, goal_revenue, goal_leads) VALUES (?, ?, ?) " +
    "ON CONFLICT(month) DO UPDATE SET goal_revenue = excluded.goal_revenue, " +
    "goal_leads = excluded.goal_leads",
  ).bind(month, revenue, leads).run();
  return { month, goal_revenue: revenue, goal_leads: leads };
}
