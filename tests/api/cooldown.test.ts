import { describe, it, expect } from "vitest";
import { checkManualSyncCooldown } from "../../src/api/handlers";

// D1 fake mínimo: guarda uma linha por "source" numa Map, só o suficiente pro
// SELECT/INSERT ON CONFLICT que checkManualSyncCooldown usa.
function fakeDb(seed: Record<string, number> = {}) {
  const store = new Map(Object.entries(seed));
  let boundKey = "";
  let boundVal = 0;
  return {
    prepare(sql: string) {
      const isSelect = sql.trim().startsWith("SELECT");
      return {
        bind(...args: any[]) {
          if (isSelect) boundKey = args[0];
          else { boundKey = args[0]; boundVal = args[1]; }
          return this;
        },
        async first() {
          return store.has(boundKey) ? { last_synced_at: store.get(boundKey) } : null;
        },
        async run() {
          store.set(boundKey, boundVal);
        },
      };
    },
  } as any;
}

describe("checkManualSyncCooldown", () => {
  it("primeira vez (sem registro): libera e grava o timestamp", async () => {
    const db = fakeDb();
    const r = await checkManualSyncCooldown({ DB: db } as any, false);
    expect(r.blocked).toBe(false);
  });

  it("incremental dentro dos 5min: bloqueia com retryInSec correto", async () => {
    const now = Math.floor(Date.now() / 1000);
    const db = fakeDb({ manual_sync: now - 60 }); // rodou há 1min
    const r = await checkManualSyncCooldown({ DB: db } as any, false);
    expect(r.blocked).toBe(true);
    expect(r.retryInSec).toBeCloseTo(5 * 60 - 60, -1);
  });

  it("incremental após 5min: libera de novo", async () => {
    const now = Math.floor(Date.now() / 1000);
    const db = fakeDb({ manual_sync: now - 5 * 60 - 5 });
    const r = await checkManualSyncCooldown({ DB: db } as any, false);
    expect(r.blocked).toBe(false);
  });

  it("full=true usa cooldown de 1h, separado do incremental", async () => {
    const now = Math.floor(Date.now() / 1000);
    // incremental liberado, mas full rodou há 10min → ainda bloqueado (1h)
    const db = fakeDb({ manual_sync_full: now - 10 * 60 });
    const r = await checkManualSyncCooldown({ DB: db } as any, true);
    expect(r.blocked).toBe(true);
    expect(r.retryInSec).toBeCloseTo(60 * 60 - 10 * 60, -1);
  });
});
