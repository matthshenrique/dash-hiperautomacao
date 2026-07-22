import { describe, it, expect, beforeEach } from "vitest";
import { createD1 } from "../../src/db/d1-sqlite";
import type { D1Database } from "@cloudflare/workers-types";

let db: D1Database;

beforeEach(async () => {
  db = createD1(":memory:");
  await db.prepare(
    "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, n INTEGER)",
  ).run();
});

describe("createD1", () => {
  it("run + first retornam dados; first devolve null quando não acha", async () => {
    await db.prepare("INSERT INTO t (id,name,n) VALUES (?,?,?)").bind(1, "a", 10).run();
    const row = await db.prepare("SELECT name,n FROM t WHERE id=?").bind(1).first<{ name: string; n: number }>();
    expect(row).toEqual({ name: "a", n: 10 });
    const none = await db.prepare("SELECT * FROM t WHERE id=?").bind(999).first();
    expect(none).toBeNull();
  });

  it("all retorna { results }", async () => {
    await db.prepare("INSERT INTO t (id,name,n) VALUES (?,?,?)").bind(1, "a", 1).run();
    await db.prepare("INSERT INTO t (id,name,n) VALUES (?,?,?)").bind(2, "b", 2).run();
    const { results } = await db.prepare("SELECT id FROM t ORDER BY id").all<{ id: number }>();
    expect(results).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("batch aplica todas as statements numa transação", async () => {
    const stmts = [
      db.prepare("INSERT INTO t (id,name,n) VALUES (?,?,?)").bind(1, "a", 1),
      db.prepare("INSERT INTO t (id,name,n) VALUES (?,?,?)").bind(2, "b", 2),
    ];
    await db.batch(stmts);
    const { results } = await db.prepare("SELECT COUNT(*) c FROM t").all<{ c: number }>();
    expect(results[0]!.c).toBe(2);
  });

  it("upsert ON CONFLICT funciona (paridade com D1)", async () => {
    const sql = "INSERT INTO t (id,name,n) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET n=excluded.n";
    await db.prepare(sql).bind(1, "a", 1).run();
    await db.prepare(sql).bind(1, "a", 99).run();
    const row = await db.prepare("SELECT n FROM t WHERE id=1").first<{ n: number }>();
    expect(row!.n).toBe(99);
  });
});
