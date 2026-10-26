import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import type { SqlDatabase, SqlStatement, SqlValue } from "../../src/storage/database.ts";

const MIGRATIONS = new URL("../../migrations/", import.meta.url);

function statement(db: DatabaseSync, query: string, values: readonly SqlValue[]): SqlStatement {
  return {
    bind: (...next) => statement(db, query, next),
    all: async () => Promise.resolve({ results: db.prepare(query).all(...values) }),
    first: async () => Promise.resolve(db.prepare(query).get(...values) ?? null),
    run: async () => Promise.resolve(db.prepare(query).run(...values)),
  };
}

export interface MemoryDatabase extends SqlDatabase {
  readonly sqlite: DatabaseSync;
}

export function memoryDatabase(): MemoryDatabase {
  const db = new DatabaseSync(":memory:");
  const migrations = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql"))
    .toSorted();
  for (const file of migrations) {
    db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  return {
    sqlite: db,
    prepare: (query) => statement(db, query, []),
    batch: async (statements) => {
      db.exec("BEGIN");
      const results: { meta: { changes: number } }[] = [];
      try {
        for (const item of statements) {
          await item.run();
          results.push({
            meta: {
              changes: Number(db.prepare("SELECT changes() AS count").get()?.["count"] ?? 0),
            },
          });
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return results;
    },
  };
}

export const FIXED_CLOCK = (): Date => new Date("2026-10-22T08:00:00Z");

export function counterRandom(): (length: number) => Uint8Array {
  let next = 0;
  return (length) => {
    next += 1;
    return new Uint8Array(length).fill(next);
  };
}
