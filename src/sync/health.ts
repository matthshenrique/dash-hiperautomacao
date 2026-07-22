// Checagem ATIVA de saúde do sync: roda periodicamente (chamada pelo cron de
// 15min em runScheduled) e dispara um webhook quando alguma fonte vira "crit".
// O widget em web/src/components/SyncStatusWidget.tsx é PASSIVO (só avisa quem
// abre o dashboard) — isto aqui cobre o caso de ninguém estar olhando.
import type { Env } from "../env";
import { log } from "./orchestrator";

export type Health = "ok" | "warn" | "crit";

interface SourceCfg {
  label: string;
  expectedSec: number;
}

// Mesmas regras de threshold do front — fonte de verdade original:
// web/src/lib/syncStatus.ts (consts SOURCES e função health()). Os dois lados
// não importam um do outro (bundles diferentes: Worker back x Vite front), por
// isso a lógica é replicada aqui manualmente; mantenha em sincronia se mudar lá.
const SOURCES: Record<string, SourceCfg> = {
  kommo: { label: "Kommo", expectedSec: 15 * 60 },
  meta: { label: "Meta", expectedSec: 2 * 60 * 60 },
  evolution: { label: "Evolution", expectedSec: 2 * 60 * 60 },
};

export interface SyncLogRow {
  source: string;
  status: string;
  finished_at: number;
}

// warn: idade do último sync > 2x o intervalo esperado.
// crit: idade > 4x o intervalo esperado, OU o último status foi "error".
// Exportado só pra teste unitário (tests/sync/health.test.ts).
export function classify(row: SyncLogRow | undefined, expectedSec: number, nowSec: number): Health {
  if (!row) return "crit"; // fonte nunca sincronizou
  if (row.status === "error") return "crit";
  const age = nowSec - row.finished_at;
  if (age > expectedSec * 4) return "crit";
  if (age > expectedSec * 2) return "warn";
  return "ok";
}

async function getLastNotified(env: Env, source: string): Promise<Health | null> {
  const row = await env.DB.prepare(
    "SELECT health FROM alert_state WHERE source = ?",
  ).bind(source).first<{ health: Health }>();
  return row?.health ?? null;
}

async function setLastNotified(env: Env, source: string, h: Health, ts: number): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO alert_state (source, health, notified_at) VALUES (?, ?, ?) " +
    "ON CONFLICT(source) DO UPDATE SET health = excluded.health, notified_at = excluded.notified_at",
  ).bind(source, h, ts).run();
}

// Formato compatível com Slack e Discord incoming webhook ({"text"} e
// {"content"} respectivamente — manda os dois pra cobrir ambos).
async function sendWebhook(url: string, text: string): Promise<void> {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, content: text }),
  });
}

// Compara o health atual de cada fonte com o último notificado (alert_state) e
// só dispara o webhook quando ele MUDA (evita ficar reenviando a cada 15min
// enquanto a fonte continua em crit). Se ALERT_WEBHOOK_URL não estiver
// configurado, é opcional: pula silenciosamente (mesmo padrão que syncEvolution
// usa quando faltam credenciais) e registra "skipped" em sync_log.
export async function checkSyncHealth(env: Env): Promise<void> {
  const started = Math.floor(Date.now() / 1000);
  if (!env.ALERT_WEBHOOK_URL) {
    await log(env, "alert", started, "skipped", 0, "ausente: ALERT_WEBHOOK_URL");
    return;
  }
  let notified = 0;
  try {
    const { results } = await env.DB.prepare(
      "SELECT source, status, finished_at FROM sync_log WHERE id IN " +
      "(SELECT MAX(id) FROM sync_log GROUP BY source)",
    ).all<SyncLogRow>();
    const bySource = new Map(results.map((r) => [r.source, r]));
    const now = Math.floor(Date.now() / 1000);

    for (const [source, cfg] of Object.entries(SOURCES)) {
      const row = bySource.get(source);
      const h = classify(row, cfg.expectedSec, now);
      const prev = await getLastNotified(env, source);
      if (prev === h) continue; // sem mudança de estado → sem alerta

      if (h === "crit") {
        const detalhe = row
          ? `status=${row.status}, último sync há ${Math.round((now - row.finished_at) / 60)}min`
          : "nunca sincronizou";
        const msg = `⚠️ Sync ${cfg.label} em estado crítico: ${detalhe}`;
        await sendWebhook(env.ALERT_WEBHOOK_URL, msg);
        notified++;
      } else if (prev === "crit" && h === "ok") {
        await sendWebhook(env.ALERT_WEBHOOK_URL, `✅ Sync ${cfg.label} normalizou`);
        notified++;
      }
      await setLastNotified(env, source, h, now);
    }
    await log(env, "alert", started, "ok", notified);
  } catch (err: any) {
    await log(env, "alert", started, "error", notified, String(err?.message ?? err));
  }
}
