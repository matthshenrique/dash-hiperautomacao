// Adapter fino: expõe a API do D1 usada em src/** sobre better-sqlite3 (síncrono).
// Retornado como D1Database via cast — nenhum arquivo de negócio precisa mudar.
import Database from "better-sqlite3";
import type { D1Database } from "@cloudflare/workers-types";

type DB = InstanceType<typeof Database>;

class Stmt {
  constructor(private db: DB, private sql: string, private args: unknown[] = []) {}

  bind(...args: unknown[]) {
    // D1 retorna uma nova statement; devolvemos clone p/ ser seguro em batch.
    return new Stmt(this.db, this.sql, args);
  }

  async first<T = unknown>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.args);
    return (row ?? null) as T | null;
  }

  async all<T = unknown>(): Promise<{ results: T[]; success: true }> {
    const results = this.db.prepare(this.sql).all(...this.args) as T[];
    return { results, success: true };
  }

  async run(): Promise<{ success: true }> {
    this.db.prepare(this.sql).run(...this.args);
    return { success: true };
  }

  // usado internamente pelo batch (síncrono, dentro da transação)
  _runSync() {
    this.db.prepare(this.sql).run(...this.args);
  }
}

export function createD1(path: string): D1Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const adapter = {
    prepare(sql: string) {
      return new Stmt(db, sql);
    },
    async batch(stmts: Stmt[]) {
      const tx = db.transaction((list: Stmt[]) => {
        for (const s of list) s._runSync();
      });
      tx(stmts);
      return stmts.map(() => ({ success: true }));
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
    // expõe o handle bruto p/ migrate.ts e testes
    _raw: db,
  };

  return adapter as unknown as D1Database;
}
