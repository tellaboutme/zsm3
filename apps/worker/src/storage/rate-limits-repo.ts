import { z } from "zod";

import { firstRow, type Store } from "./database.ts";
import { CONSUME_RATE_LIMIT, PRUNE_RATE_LIMITS } from "./rate-limits-sql.ts";
import { hmacSha256 } from "../security/hmac.ts";

export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MINUTES = 10;
export const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
export const RATE_LIMIT_PRUNE_BATCH = 1000;

export interface RateLimitState {
  readonly count: number;
  readonly windowStartedAt: string;
}

export interface RateLimitsRepo {
  consume(keyHash: Uint8Array, now: string, cutoff: string): Promise<RateLimitState>;
  prune(cutoff: string, limit: number): Promise<void>;
}

export type RateLimitPurpose = "submit" | "status" | "withdraw";

export async function rateLimitKey(
  salt: string,
  ip: string,
  purpose: RateLimitPurpose = "submit",
): Promise<Uint8Array> {
  return hmacSha256(salt, `${purpose}:${ip}`);
}

export function rateLimitsRepo(store: Store): RateLimitsRepo {
  const { db } = store;
  return {
    prune: async (cutoff, limit) => {
      await db.prepare(PRUNE_RATE_LIMITS).bind(cutoff, limit).run();
    },
    consume: async (keyHash, now, cutoff) => {
      const row = await firstRow(
        db.prepare(CONSUME_RATE_LIMIT).bind(keyHash, now, cutoff),
        z.strictObject({ count: z.number(), window_started_at: z.string() }),
      );
      if (row === undefined) {
        throw new Error("The rate limit row is missing");
      }
      return { count: row.count, windowStartedAt: row.window_started_at };
    },
  };
}
