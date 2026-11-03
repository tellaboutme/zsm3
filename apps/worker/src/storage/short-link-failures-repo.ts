import { z } from "zod";

import { firstRow, type Store } from "./database.ts";
import { PRUNE_FAILURES, RELEASE_FAILURE, RESERVE_FAILURE } from "./short-link-failures-sql.ts";

export const DAILY_FAILED_ATTEMPTS = 100;
export const FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const FAILURE_PRUNE_BATCH = 1000;

export interface ShortLinkFailuresRepo {
  reserve(code: string, now: Date): Promise<number | undefined>;
  release(slot: number): Promise<void>;
  prune(now: Date, limit: number): Promise<void>;
}

const slotSchema = z.strictObject({ id: z.number().int().positive() });

export function shortLinkFailuresRepo(store: Store): ShortLinkFailuresRepo {
  const { db } = store;
  return {
    reserve: async (code, now) => {
      const at = now.getTime();
      const statement = db
        .prepare(RESERVE_FAILURE)
        .bind(code, at, at - FAILURE_WINDOW_MS, DAILY_FAILED_ATTEMPTS);
      return (await firstRow(statement, slotSchema))?.id;
    },
    release: async (slot) => {
      await db.prepare(RELEASE_FAILURE).bind(slot).run();
    },
    prune: async (now, limit) => {
      await db
        .prepare(PRUNE_FAILURES)
        .bind(now.getTime() - FAILURE_WINDOW_MS, limit)
        .run();
    },
  };
}
