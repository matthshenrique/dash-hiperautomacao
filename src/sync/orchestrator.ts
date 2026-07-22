import type { Env } from "../env";
import { iterLeads, iterStatusEvents, iterDeletedLeadIds, fetchStatuses } from "../lib/kommoClient";
import { parseLead, parseStatusEvent } from "./kommo";
import { fetchInsights } from "../lib/metaClient";
import { parseInsight } from "./meta";
import { fetchMessages } from "../lib/evolutionClient";
import { parseMessage } from "./evolution";
import { daysAgo, ymd } from "../lib/date";
import { CLIENT } from "../../config/client";
import { checkSyncHealth } from "./health";

async function getState(env: Env, source: string): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT last_synced_at FROM sync_state WHERE source = ?",
  ).bind(source).first<{ last_synced_at: number }>();
  return row?.last_synced_at ?? 0;
}

async function setState(env: Env, source: string, ts: number): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO sync_state (source, last_synced_at) VALUES (?, ?) " +
    "ON CONFLICT(source) DO UPDATE SET last_synced_at = excluded.last_synced_at",
  ).bind(source, ts).run();
}

// Exportado p/ src/sync/health.ts reusar o mesmo formato de linha em sync_log.
export async function log(
  env: Env, source: string, started: number, status: string,
  rows: number, error?: string,
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO sync_log (source, started_at, finished_at, status, rows, error) " +
    "VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(source, started, Math.floor(Date.now() / 1000), status, rows, error ?? null).run();
}

export async function syncKommo(env: Env): Promise<void> {
  const started = Math.floor(Date.now() / 1000);
  let rows = 0;
  try {
    const since = await getState(env, "kommo");
    // Grava em lotes (db.batch) p/ o backfill caber no tempo do Worker.
    const CHUNK = 50;
    let buf: D1PreparedStatement[] = [];

    for await (const raw of iterLeads(env.KOMMO_TOKEN, since)) {
      const l = parseLead(raw);
      buf.push(env.DB.prepare(
        `INSERT INTO leads (id,pipeline_id,status_id,price,created_at,closed_at,
           updated_at,loss_reason_id,loss_reason,produto,utm_source,utm_campaign,
           utm_content,responsible_user_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           pipeline_id=excluded.pipeline_id, status_id=excluded.status_id,
           price=excluded.price, closed_at=excluded.closed_at,
           updated_at=excluded.updated_at, loss_reason_id=excluded.loss_reason_id,
           loss_reason=excluded.loss_reason, produto=excluded.produto,
           utm_source=excluded.utm_source, utm_campaign=excluded.utm_campaign,
           utm_content=excluded.utm_content,
           responsible_user_id=excluded.responsible_user_id`,
      ).bind(
        l.id, l.pipeline_id, l.status_id, l.price, l.created_at, l.closed_at,
        l.updated_at, l.loss_reason_id, l.loss_reason, l.produto, l.utm_source,
        l.utm_campaign, l.utm_content, l.responsible_user_id,
      ));
      rows++;
      if (buf.length >= CHUNK) { await env.DB.batch(buf); buf = []; }
    }
    if (buf.length) { await env.DB.batch(buf); buf = []; }

    for await (const raw of iterStatusEvents(env.KOMMO_TOKEN, since)) {
      const e = parseStatusEvent(raw);
      buf.push(env.DB.prepare(
        `INSERT INTO lead_events (id,lead_id,created_at,status_before,status_after)
         VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
      ).bind(e.id, e.lead_id, e.created_at, e.status_before, e.status_after));
      if (buf.length >= CHUNK) { await env.DB.batch(buf); buf = []; }
    }
    if (buf.length) { await env.DB.batch(buf); buf = []; }

    // Exclusões: remove do D1 os leads apagados no Kommo desde o último sync.
    for await (const id of iterDeletedLeadIds(env.KOMMO_TOKEN, since)) {
      buf.push(env.DB.prepare("DELETE FROM leads WHERE id = ?").bind(id));
      buf.push(env.DB.prepare("DELETE FROM lead_events WHERE lead_id = ?").bind(id));
      if (buf.length >= CHUNK) { await env.DB.batch(buf); buf = []; }
    }
    if (buf.length) { await env.DB.batch(buf); buf = []; }

    // Nomes das etapas (p/ rotular receita por status). Upsert simples.
    for (const s of await fetchStatuses(env.KOMMO_TOKEN)) {
      buf.push(env.DB.prepare(
        "INSERT INTO crm_statuses (id,name) VALUES (?,?) " +
        "ON CONFLICT(id) DO UPDATE SET name=excluded.name",
      ).bind(s.id, s.name));
      if (buf.length >= CHUNK) { await env.DB.batch(buf); buf = []; }
    }
    if (buf.length) { await env.DB.batch(buf); buf = []; }

    await setState(env, "kommo", started);
    await log(env, "kommo", started, "ok", rows);
  } catch (err: any) {
    await log(env, "kommo", started, "error", rows, String(err?.message ?? err));
    throw err;
  }
}

// full=true no backfill (90 dias); senão hoje+ontem.
export async function syncMeta(env: Env, full = false): Promise<void> {
  const started = Math.floor(Date.now() / 1000);
  let rows = 0;
  try {
    // 1º run (sem cursor meta) faz backfill de 90 dias automaticamente.
    const metaState = await getState(env, "meta");
    const since = full || metaState === 0 ? daysAgo(90) : daysAgo(1);
    const until = ymd(Math.floor(Date.now() / 1000));
    const insights = await fetchInsights(env.META_TOKEN, since, until);
    // Grava em lotes (db.batch), como o Kommo, senão o backfill de 90 dias
    // (centenas/milhares de linhas, uma query sequencial cada) estoura o
    // orçamento de tempo do waitUntil() e o Worker cancela a tarefa no meio —
    // sem gravar sucesso nem erro no sync_log.
    const CHUNK = 50;
    let buf: D1PreparedStatement[] = [];
    for (const raw of insights) {
      const a = parseInsight(raw);
      buf.push(env.DB.prepare(
        `INSERT INTO ad_insights
           (date,ad_id,ad_name,campaign_id,campaign_name,spend,impressions,clicks,leads)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(date,ad_id) DO UPDATE SET
           ad_name=excluded.ad_name, campaign_id=excluded.campaign_id,
           campaign_name=excluded.campaign_name, spend=excluded.spend,
           impressions=excluded.impressions, clicks=excluded.clicks,
           leads=excluded.leads`,
      ).bind(
        a.date, a.ad_id, a.ad_name, a.campaign_id, a.campaign_name,
        a.spend, a.impressions, a.clicks, a.leads,
      ));
      rows++;
      if (buf.length >= CHUNK) { await env.DB.batch(buf); buf = []; }
    }
    if (buf.length) await env.DB.batch(buf);
    await setState(env, "meta", started);
    await log(env, "meta", started, "ok", rows);
  } catch (err: any) {
    await log(env, "meta", started, "error", rows, String(err?.message ?? err));
    throw err;
  }
}

// Mensagens do WhatsApp (Evolution) → metadados p/ tempo de resposta.
export async function syncEvolution(env: Env): Promise<void> {
  const started = Math.floor(Date.now() / 1000);
  const evoUrl = env.EVOLUTION_URL || CLIENT.evolutionUrl;
  if (!CLIENT.evolutionInstance || !evoUrl || !env.EVOLUTION_KEY) {
    const faltando = [
      !CLIENT.evolutionInstance && "evolutionInstance",
      !evoUrl && "evolutionUrl",
      !env.EVOLUTION_KEY && "EVOLUTION_KEY",
    ].filter(Boolean).join(", ");
    await log(env, "evolution", started, "skipped", 0, `ausente: ${faltando}`);
    return;
  }
  let rows = 0;
  try {
    const raws = await fetchMessages(env, CLIENT.evolutionInstance);
    let buf: D1PreparedStatement[] = [];
    for (const r of raws) {
      const m = parseMessage(r);
      if (!m) continue;
      buf.push(env.DB.prepare(
        "INSERT INTO wa_messages (id,chat,from_me,ts) VALUES (?,?,?,?) " +
        "ON CONFLICT(id) DO NOTHING",
      ).bind(m.id, m.chat, m.from_me, m.ts));
      rows++;
      if (buf.length >= 50) { await env.DB.batch(buf); buf = []; }
    }
    if (buf.length) await env.DB.batch(buf);
    await log(env, "evolution", started, "ok", rows);
  } catch (err: any) {
    await log(env, "evolution", started, "error", rows, String(err?.message ?? err));
    throw err;
  }
}

export async function runScheduled(env: Env, cron: string): Promise<void> {
  // Cron de 2h roda Meta + Evolution (evita rodar Kommo em dobro às :00, já que
  // o cron de 15min também dispara nesse minuto). Demais disparos = Kommo +
  // checagem ativa de saúde (é o cron mais frequente, cobre as 3 fontes com
  // latência de detecção razoável).
  const tasks: Promise<void>[] =
    cron === "0 */2 * * *" ? [syncMeta(env), syncEvolution(env)] : [syncKommo(env), checkSyncHealth(env)];
  await Promise.allSettled(tasks);
}
