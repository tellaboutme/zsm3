import { describe, it } from "vitest";

import { attempt, RIGHT, seed, START, store, WRONG } from "./short-link-daily-support.ts";
import { PASSWORD_ATTEMPTS } from "../../src/short-links/resolve.ts";
import { rateLimitsRepo } from "../../src/storage/rate-limits-repo.ts";

const COUNT = "SELECT count FROM rate_limits WHERE key_hash = ?1";

describe("the 10-minute guess budget", () => {
  it("keeps counting wrong guesses after the right password arrives", async ({ expect }) => {
    const current = store();
    await seed(current);
    for (let index = 0; index < PASSWORD_ATTEMPTS - 1; index += 1) {
      await expect(attempt(current, WRONG, START)).resolves.toBe("locked");
    }
    for (let reader = 0; reader < 3; reader += 1) {
      await expect(attempt(current, RIGHT, START)).resolves.toBe("redirect");
    }

    await expect(attempt(current, WRONG, START)).resolves.toBe("locked");
    await expect(attempt(current, WRONG, START)).resolves.toBe("throttled");
    await expect(attempt(current, RIGHT, START)).resolves.toBe("throttled");
  });

  it("gives back only the right password's own attempt", async ({ expect }) => {
    const current = store();
    await seed(current);
    await attempt(current, WRONG, START);
    await attempt(current, RIGHT, START);

    await expect(current.db.prepare("SELECT count FROM rate_limits").all()).resolves.toEqual({
      results: [{ count: 1 }],
    });
  });

  it("refunds only within the window the attempt was counted in", async ({ expect }) => {
    const current = store();
    const repo = rateLimitsRepo(current);
    const key = new Uint8Array([9]);
    const old = await repo.consume(key, "2026-10-22T08:00:00.000Z", "2026-10-22T07:50:00.000Z");
    await repo.consume(key, "2026-10-22T08:20:00.000Z", "2026-10-22T08:10:00.000Z");
    await repo.refund(key, old.windowStartedAt);
    await repo.refund(new Uint8Array([8]), old.windowStartedAt);
    await expect(current.db.prepare(COUNT).bind(key).first()).resolves.toEqual({ count: 1 });

    const fresh = await repo.consume(key, "2026-10-22T08:21:00.000Z", "2026-10-22T08:11:00.000Z");
    for (let index = 0; index < 3; index += 1) {
      await repo.refund(key, fresh.windowStartedAt);
    }
    await expect(current.db.prepare(COUNT).bind(key).first()).resolves.toEqual({ count: 0 });
  });
});
