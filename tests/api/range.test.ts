import { describe, it, expect, vi, afterEach } from "vitest";
import { range } from "../../src/api/handlers";

const u = (qs: string) => new URL(`https://x.test/api/overview${qs}`);

describe("range", () => {
  afterEach(() => vi.useRealTimers());

  it("from/to explícitos: fromU/toU batem com meia-noite/23:59:59 de Brasília (UTC-3)", () => {
    const r = range(u("?from=2026-07-19&to=2026-07-19"));
    // 00:00 BRT do dia 19 = 03:00 UTC do dia 19
    expect(r.fromU).toBe(Date.UTC(2026, 6, 19, 3, 0, 0) / 1000);
    // 23:59:59 BRT do dia 19 = 02:59:59 UTC do dia 20 (bug original: isso
    // fazia toISOString() cair no dia 20, duplicando o spend de "hoje")
    expect(r.toU).toBe(Date.UTC(2026, 6, 20, 2, 59, 59) / 1000);
  });

  it("fromYmd/toYmd são as strings originais da query, não redespachadas do epoch", () => {
    // Regressão: reconverter toU (já com offset BR) via toISOString().slice(0,10)
    // empurra a data pro dia seguinte em UTC e duplicava o investido de "ontem".
    const r = range(u("?from=2026-07-19&to=2026-07-19"));
    expect(r.fromYmd).toBe("2026-07-19");
    expect(r.toYmd).toBe("2026-07-19");
  });

  it("período de vários dias preserva from/to exatos", () => {
    const r = range(u("?from=2026-07-01&to=2026-07-31"));
    expect(r.fromYmd).toBe("2026-07-01");
    expect(r.toYmd).toBe("2026-07-31");
    expect(r.month).toBe("2026-07");
  });

  it("sem 'to': usa o instante atual (não fim do dia)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T18:30:00Z"));
    const r = range(u("?from=2026-07-01"));
    expect(r.toU).toBe(Math.floor(new Date("2026-07-20T18:30:00Z").getTime() / 1000));
  });

  it("sem 'from' nem 'to': cai no 1º dia do mês corrente (UTC) até agora", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T18:30:00Z"));
    const r = range(u(""));
    expect(r.fromYmd).toBe("2026-07-01");
    expect(r.month).toBe("2026-07");
  });
});
