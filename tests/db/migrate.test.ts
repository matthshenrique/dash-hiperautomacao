import { describe, it, expect } from "vitest";
import { createD1 } from "../../src/db/d1-sqlite";
import { runMigrations } from "../../src/db/migrate";

describe("runMigrations", () => {
  it("cria as tabelas do schema e é idempotente", async () => {
    const db = createD1(":memory:");
    const n1 = await runMigrations(db, "migrations");
    expect(n1).toBeGreaterThan(0); // aplicou as .sql existentes

    // tabela central existe
    const t = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='leads'",
    ).first<{ name: string }>();
    expect(t?.name).toBe("leads");

    // rodar de novo não reaplica nada
    const n2 = await runMigrations(db, "migrations");
    expect(n2).toBe(0);
  });
});
