import { redirectSchema, type Redirect } from "@zsm3/contracts/content";
import { z } from "zod";

import { firstRow, timestamp, type Store } from "./database.ts";

export interface RedirectsRepo {
  save(redirect: Redirect): Promise<void>;
  target(path: string): Promise<string | undefined>;
}

const UPSERT = `INSERT INTO redirects (from_path, to_path, created_at) VALUES (?, ?, ?)
  ON CONFLICT (from_path) DO UPDATE SET to_path = excluded.to_path`;

const SELECT_TARGET = "SELECT to_path FROM redirects WHERE from_path = ?";

export function normalisePath(path: string): string {
  const trimmed = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return trimmed.toLowerCase();
}

export function redirectsRepo({ db, clock }: Store): RedirectsRepo {
  return {
    save: async (redirect) => {
      const parsed = redirectSchema.parse(redirect);
      await db.prepare(UPSERT).bind(normalisePath(parsed.from), parsed.to, timestamp(clock)).run();
    },
    target: async (path) => {
      const row = await firstRow(
        db.prepare(SELECT_TARGET).bind(normalisePath(path)),
        z.object({ to_path: z.string() }),
      );
      return row?.to_path;
    },
  };
}
