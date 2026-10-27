import { env } from "cloudflare:workers";
import { describe, it } from "vitest";

import { body, jsonPost, setupRequestsTest } from "./requests-workers-helpers.ts";
import { liveStore } from "../src/storage/database.ts";
import { outboxRepo } from "../src/storage/outbox-repo.ts";

setupRequestsTest();

describe("D1 outbox leases", () => {
  it("claims confirmations atomically and rejects stale acknowledgement", async ({ expect }) => {
    const created = await jsonPost("/api/requests", body(), "198.51.100.220");
    expect(created.status).toBe(201);
    const repo = outboxRepo(liveStore(env.DB));
    const now = new Date();
    const claimed = await repo.claim(now, 2);
    expect(claimed).toHaveLength(2);
    expect(await outboxRepo(liveStore(env.DB)).claim(now, 2)).toHaveLength(0);
    const reclaimed = await outboxRepo(liveStore(env.DB)).claim(
      new Date(now.getTime() + 120_001),
      2,
    );
    expect(reclaimed).toHaveLength(2);
    const first = claimed[0];
    if (first === undefined) return expect.unreachable();
    expect(await repo.markSent(first)).toBe(false);
    for (const row of reclaimed) {
      expect(await repo.markSent(row)).toBe(true);
    }
  });
});
