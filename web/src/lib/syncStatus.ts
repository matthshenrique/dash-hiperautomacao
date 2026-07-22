export interface SyncLogRow {
  source: string; status: string; rows: number; error: string | null; finished_at: number;
}

export type Health = "ok" | "warn" | "crit";

export interface SourceInfo {
  key: string; label: string; intervalSec: number;
}

export const SOURCES: SourceInfo[] = [
  { key: "kommo", label: "Kommo (CRM)", intervalSec: 15 * 60 },
  { key: "meta", label: "Meta Ads (investido)", intervalSec: 2 * 3600 },
  { key: "evolution", label: "WhatsApp (Evolution)", intervalSec: 2 * 3600 },
];

// Atraso tolerado antes de virar aviso/crítico: 2x e 4x o intervalo esperado.
export function health(row: SyncLogRow | undefined, intervalSec: number, nowSec: number): Health {
  if (!row) return "crit";
  if (row.status === "error") return "crit";
  if (row.status === "skipped") return "warn";
  const age = nowSec - row.finished_at;
  if (age > intervalSec * 4) return "crit";
  if (age > intervalSec * 2) return "warn";
  return "ok";
}

export function relTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return "agora";
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h}h ${m}min` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

// Cloudflare Cron Triggers avaliam o cron em UTC — calcula a próxima marca
// independente do último sync ter dado certo ou não.
export function nextRun(cadence: "15min" | "2h", now: Date): Date {
  const next = new Date(now);
  if (cadence === "15min") {
    next.setUTCSeconds(0, 0);
    const m = next.getUTCMinutes();
    next.setUTCMinutes(Math.floor(m / 15) * 15 + 15);
  } else {
    next.setUTCMinutes(0, 0, 0);
    const h = next.getUTCHours();
    next.setUTCHours(h % 2 === 0 ? h + 2 : h + 1);
  }
  return next;
}
