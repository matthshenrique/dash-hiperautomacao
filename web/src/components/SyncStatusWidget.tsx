import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import {
  SOURCES, health, relTime, nextRun, type SyncLogRow, type Health,
} from "../lib/syncStatus";

const DOT_COLOR: Record<Health, string> = {
  ok: "var(--good)", warn: "var(--warn)", crit: "var(--crit)",
};

export function SyncStatusWidget() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SyncLogRow[] | null>(null);
  const [err, setErr] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0); // epoch (segundos)
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!open || rows) return;
    api<SyncLogRow[]>("sync-status").then(setRows).catch((e) => setErr(String(e)));
  }, [open, rows]);

  // Re-renderiza a cada segundo enquanto o popover tá aberto e tem cooldown
  // rodando, só pra atualizar o texto de contagem regressiva.
  useEffect(() => {
    if (!open || cooldownUntil <= Date.now() / 1000) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [open, cooldownUntil]);

  const nowSyncCheck = Date.now() / 1000;
  const cooling = cooldownUntil > nowSyncCheck;

  const triggerSync = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      await api<{ started: boolean }>("sync");
      setSyncMsg("Disparado — deve levar cerca de 1 minuto pra refletir aqui.");
      setCooldownUntil(Date.now() / 1000 + 5 * 60);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        const retry = Number(e.body?.retryInSec ?? 300);
        setCooldownUntil(Date.now() / 1000 + retry);
        setSyncMsg(`Aguarde ${relTime(retry)} pra sincronizar de novo.`);
      } else {
        setSyncMsg("Erro ao disparar a sincronização.");
      }
    } finally {
      setSyncing(false);
    }
  };

  const now = Date.now() / 1000;
  const byKey = new Map((rows ?? []).map((r) => [r.source, r]));
  const worst: Health = rows
    ? SOURCES.reduce<Health>((acc, s) => {
      const h = health(byKey.get(s.key), s.intervalSec, now);
      return h === "crit" || acc === "crit" ? (h === "crit" ? "crit" : acc)
        : h === "warn" || acc === "warn" ? "warn" : "ok";
    }, "ok")
    : "ok";

  return (
    <div className="dr">
      <button className="btn icon" title="Status da sincronização" aria-label="Status da sincronização"
        onClick={() => setOpen((o) => !o)} style={{ position: "relative" }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
        </svg>
        {rows && (
          <span style={{
            position: "absolute", top: 6, right: 6, width: 8, height: 8,
            borderRadius: "50%", background: DOT_COLOR[worst],
            border: "1.5px solid var(--card)",
          }} />
        )}
      </button>

      {open && (
        <>
          <div className="backdrop" onClick={() => setOpen(false)} />
          <div className="dr-menu status-menu">
            <div className="status-head">Status da sincronização</div>
            {err && <div className="empty" style={{ padding: "0 14px 14px" }}>Erro ao carregar: {err}</div>}
            {!rows && !err && <div className="empty" style={{ padding: "0 14px 14px" }}>Carregando…</div>}
            {rows && SOURCES.map((s) => {
              const row = byKey.get(s.key);
              const h = health(row, s.intervalSec, now);
              const cadence = s.key === "kommo" ? "15min" : "2h";
              const next = nextRun(cadence, new Date());
              return (
                <div className="status-row" key={s.key}>
                  <div className="status-row-head">
                    <span className="dot" style={{ background: DOT_COLOR[h] }} />
                    <strong>{s.label}</strong>
                  </div>
                  {row ? (
                    <div className="status-detail">
                      última: {row.status === "error" ? "erro" : row.status === "skipped" ? "não configurado" : "ok"}
                      {" · há "}{relTime(now - row.finished_at)}
                      {row.status === "ok" && typeof row.rows === "number" ? ` · ${row.rows} linhas` : ""}
                      {row.error && <div className="status-err">{row.error}</div>}
                    </div>
                  ) : (
                    <div className="status-detail">nunca sincronizou</div>
                  )}
                  <div className="status-detail">
                    próxima: em {relTime((next.getTime() - Date.now()) / 1000)}
                  </div>
                </div>
              );
            })}
            {rows && (
              <div className="status-row">
                <button className="btn" style={{ width: "100%", justifyContent: "center" }}
                  disabled={syncing || cooling}
                  onClick={triggerSync}>
                  {syncing ? "Disparando…"
                    : cooling ? `Aguarde ${relTime(cooldownUntil - nowSyncCheck)}`
                    : "Sincronizar agora"}
                </button>
                {syncMsg && <div className="status-detail" style={{ paddingLeft: 0, marginTop: 8 }}>{syncMsg}</div>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
