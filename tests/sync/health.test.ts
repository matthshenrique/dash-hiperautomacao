import { describe, it, expect } from "vitest";
import { classify, type SyncLogRow } from "../../src/sync/health";

const KOMMO_SEC = 15 * 60;
const META_SEC = 2 * 3600;
const NOW = 1_000_000;

describe("classify (saúde do sync)", () => {
  it("nunca sincronizou (sem linha) → crit", () => {
    expect(classify(undefined, KOMMO_SEC, NOW)).toBe("crit");
  });

  it("último status 'error' → crit, mesmo recente", () => {
    const row: SyncLogRow = { source: "kommo", status: "error", finished_at: NOW - 10 };
    expect(classify(row, KOMMO_SEC, NOW)).toBe("crit");
  });

  it("idade dentro do esperado → ok", () => {
    const row: SyncLogRow = { source: "kommo", status: "ok", finished_at: NOW - KOMMO_SEC };
    expect(classify(row, KOMMO_SEC, NOW)).toBe("ok");
  });

  it("idade > 2x o esperado → warn", () => {
    const row: SyncLogRow = { source: "kommo", status: "ok", finished_at: NOW - KOMMO_SEC * 2.5 };
    expect(classify(row, KOMMO_SEC, NOW)).toBe("warn");
  });

  it("idade > 4x o esperado → crit (caso do bug do syncMeta cancelado pelo waitUntil)", () => {
    const row: SyncLogRow = { source: "meta", status: "ok", finished_at: NOW - META_SEC * 5 };
    expect(classify(row, META_SEC, NOW)).toBe("crit");
  });

  it("exatamente no limite de 2x ainda é ok (só warn quando ultrapassa)", () => {
    const row: SyncLogRow = { source: "kommo", status: "ok", finished_at: NOW - KOMMO_SEC * 2 };
    expect(classify(row, KOMMO_SEC, NOW)).toBe("ok");
  });
});
