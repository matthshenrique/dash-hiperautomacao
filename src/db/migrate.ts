import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { D1Database } from "@cloudflare/workers-types";

// Aplica as migrations .sql que ainda não rodaram. Retorna quantas aplicou.
export async function runMigrations(db: D1Database, dir: string): Promise<number> {
  const raw = (db as any)._raw; // better-sqlite3 handle (ver createD1)
  raw.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER)");

  const applied = new Set<string>(
    raw.prepare("SELECT name FROM schema_migrations").all().map((r: any) => r.name),
  );

  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let count = 0;
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = readFileSync(join(dir, f), "utf8");
    const tx = raw.transaction(() => {
      raw.exec(sql);
      raw.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)")
        .run(f, Math.floor(Date.now() / 1000));
    });
    tx();
    count++;
  }
  return count;
}
