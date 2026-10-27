import { redirectSchema, type Redirect } from "@zsm3/contracts/content";
import { z } from "zod";

import { firstRow, timestamp, type SqlStatement, type Store } from "./database.ts";

export interface RedirectsRepo {
  save(redirect: Redirect): Promise<void>;
  saveStatement(redirect: Redirect): SqlStatement;
  delete(path: string): Promise<void>;
  deleteStatement(path: string): SqlStatement;
  target(path: string): Promise<string | undefined>;
}

const UPSERT = `INSERT INTO redirects (from_path, to_path, created_at) VALUES (?, ?, ?)
  ON CONFLICT (from_path) DO UPDATE SET to_path = excluded.to_path`;

const DELETE = "DELETE FROM redirects WHERE from_path = ?";

const SELECT_TARGET = "SELECT to_path FROM redirects WHERE from_path = ?";

export function normalisePath(path: string): string {
  const trimmed = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return trimmed.toLowerCase();
}

function saveStatement({ db, clock }: Store, redirect: Redirect): SqlStatement {
  const parsed = redirectSchema.parse(redirect);
  return db.prepare(UPSERT).bind(normalisePath(parsed.from), parsed.to, timestamp(clock));
}

export function redirectsRepo(store: Store): RedirectsRepo {
  const { db } = store;
  const deleteStatement = (path: string): SqlStatement =>
    db.prepare(DELETE).bind(normalisePath(path));
  return {
    save: async (redirect) => {
      await db.batch([saveStatement(store, redirect)]);
    },
    saveStatement: (redirect) => saveStatement(store, redirect),
    delete: async (path) => {
      await db.batch([deleteStatement(path)]);
    },
    deleteStatement: (path) => deleteStatement(path),
    target: async (path) => {
      const row = await firstRow(
        db.prepare(SELECT_TARGET).bind(normalisePath(path)),
        z.object({ to_path: z.string() }),
      );
      return row?.to_path;
    },
  };
}
