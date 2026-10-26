import { describe, it } from "vitest";

import { counterRandom, memoryDatabase } from "./memory-database.ts";
import type { Store } from "../../src/storage/database.ts";
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MINUTES,
  rateLimitKey,
  rateLimitsRepo,
} from "../../src/storage/rate-limits-repo.ts";

function mutableClock() {
  let now = new Date("2026-10-22T08:00:00Z");
  const clock = (): Date => now;
  return {
    clock,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

describe("rateLimitKey", () => {
  it("hides the ip behind the salt", async ({ expect }) => {
    const key = await rateLimitKey("salt", "1.2.3.4");
    expect(key).toHaveLength(32);
    expect(await rateLimitKey("salt", "1.2.3.4")).toEqual(key);
    expect(await rateLimitKey("other", "1.2.3.4")).not.toEqual(key);
    expect(await rateLimitKey("salt", "5.6.7.8")).not.toEqual(key);
  });
});

describe("rateLimitsRepo", () => {
  it("rejects a missing database row", async ({ expect }) => {
    const store: Store = { db: memoryDatabase(), clock: () => new Date(), random: counterRandom() };
    const raw = store.db;
    const repo = rateLimitsRepo({
      ...store,
      db: {
        ...raw,
        prepare: (query) => ({
          ...raw.prepare(query),
          bind: (...values) => ({
            ...raw.prepare(query).bind(...values),
            first: async () => Promise.resolve(null),
          }),
        }),
      },
    });

    await expect(repo.consume(new Uint8Array(32), "now", "cutoff")).rejects.toThrow(
      "The rate limit row is missing",
    );
  });
  it("counts requests within one window and starts a new one after the cutoff", async ({
    expect,
  }) => {
    const time = mutableClock();
    const repo = rateLimitsRepo({
      db: memoryDatabase(),
      clock: time.clock,
      random: counterRandom(),
    });
    const key = await rateLimitKey("salt", "1.2.3.4");

    for (const expected of [1, 2, 3, 4, 5, 6]) {
      const state = await repo.consume(key, time.clock().toISOString(), cutoff(time.clock()));
      expect(state.count).toBe(expected);
    }

    time.advance(RATE_LIMIT_WINDOW_MINUTES * 60_000 + 1);
    const renewed = await repo.consume(key, time.clock().toISOString(), cutoff(time.clock()));
    expect(renewed.count).toBe(1);
    expect(new Date(renewed.windowStartedAt).getTime()).toBe(time.clock().getTime());
  });

  it("keeps one window while the cutoff has not passed", async ({ expect }) => {
    const time = mutableClock();
    const repo = rateLimitsRepo({
      db: memoryDatabase(),
      clock: time.clock,
      random: counterRandom(),
    });
    const key = await rateLimitKey("salt", "1.2.3.4");

    await repo.consume(key, time.clock().toISOString(), cutoff(time.clock()));
    time.advance(60_000);
    const state = await repo.consume(key, time.clock().toISOString(), cutoff(time.clock()));

    expect(state.count).toBe(2);
    expect(new Date(state.windowStartedAt).getTime()).toBe(time.clock().getTime() - 60_000);
  });

  it("separates buckets by key", async ({ expect }) => {
    const time = mutableClock();
    const repo = rateLimitsRepo({
      db: memoryDatabase(),
      clock: time.clock,
      random: counterRandom(),
    });
    const first = await rateLimitKey("salt", "1.2.3.4");
    const second = await rateLimitKey("salt", "5.6.7.8");

    await repo.consume(first, time.clock().toISOString(), cutoff(time.clock()));
    const state = await repo.consume(second, time.clock().toISOString(), cutoff(time.clock()));

    expect(state.count).toBe(1);
  });

  it("documents the public limits", ({ expect }) => {
    expect(RATE_LIMIT_MAX).toBe(5);
    expect(RATE_LIMIT_WINDOW_MINUTES).toBe(10);
  });
});

function cutoff(now: Date): string {
  return new Date(now.getTime() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
}
