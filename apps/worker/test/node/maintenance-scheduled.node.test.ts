import { describe, it } from "vitest";

import { harness, NOW, SECRETS, setStatus } from "./maintenance-harness.ts";
import { runScheduledMaintenance } from "../../src/jobs/retention.ts";

describe("runScheduledMaintenance", () => {
  it("prunes expired IP hashes in bounded batches even after retention ran today", async ({
    expect,
  }) => {
    const h = harness();
    for (let index = 0; index < 1001; index += 1) {
      await h.store.db
        .prepare("INSERT INTO rate_limits (key_hash, window_started_at, count) VALUES (?, ?, 1)")
        .bind(new Uint8Array([index >> 8, index & 255]), "2020-01-01T00:00:00Z")
        .run();
    }
    await h.store.db
      .prepare("INSERT INTO rate_limits (key_hash, window_started_at, count) VALUES (?, ?, 1)")
      .bind(new Uint8Array([255, 255]), NOW.toISOString())
      .run();
    const count = async () =>
      await h.store.db.prepare("SELECT count(*) AS total FROM rate_limits").first();
    await runScheduledMaintenance({ ...SECRETS, DB: h.store.db }, h.store, NOW);
    await expect(count()).resolves.toMatchObject({ total: 2 });
    await runScheduledMaintenance({ ...SECRETS, DB: h.store.db }, h.store, NOW);
    await expect(count()).resolves.toMatchObject({ total: 1 });
  });
  it("resumes beyond the per-run cap without waiting for another day", async ({ expect }) => {
    const h = harness();
    await h.store.db
      .prepare(
        `WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM numbers WHERE n < 1001)
      INSERT INTO requests (id, type, status, pii_ciphertext, pii_key_id, status_token_hash, form_key, created_at, updated_at, closed_at)
      SELECT 'backlog-' || n, 'STUDENT_ID_RENEWAL', 'collected', x'01', 'PRIMARY', randomblob(32), 'backlog-form-' || n,
        '2020-01-01T00:00:00Z', '2020-01-01T00:00:00Z', '2020-01-01T00:00:00Z' FROM numbers`,
      )
      .run();
    const env = { ...SECRETS, DB: h.store.db };
    expect((await runScheduledMaintenance(env, h.store, NOW)).erased).toBe(1000);
    expect((await runScheduledMaintenance(env, h.store, NOW)).erased).toBe(1);
    expect((await runScheduledMaintenance(env, h.store, NOW)).erased).toBe(0);
  });

  it("drains multiple batches and ignores already erased closed rows", async ({ expect }) => {
    const h = harness();
    for (let index = 0; index < 101; index += 1) {
      const id = `closed-${String(index)}`;
      await h.add(id);
      await setStatus(h, {
        id,
        status: "collected",
        updatedAt: "2020-01-01T00:00:00Z",
        closedAt: "2020-01-01T00:00:00Z",
      });
    }
    const first = await runScheduledMaintenance({ ...SECRETS, DB: h.store.db }, h.store, NOW);
    expect(first.erased).toBe(101);
    const second = await runScheduledMaintenance({ ...SECRETS, DB: h.store.db }, h.store, NOW);
    expect(second.erased).toBe(0);
    const third = await runScheduledMaintenance({ ...SECRETS, DB: h.store.db }, h.store, NOW);
    expect(third.erased).toBe(0);
    expect(await h.requests.listClosedBefore(NOW.toISOString(), 100)).toHaveLength(0);
  });

  it("drains every tick and applies the retention once per utc day", async ({ expect }) => {
    const h = harness();
    await h.add("old-closed");
    await setStatus(h, {
      id: "old-closed",
      status: "collected",
      updatedAt: "2026-09-01T08:00:00Z",
      closedAt: "2026-09-01T08:00:00Z",
    });
    await h.add("anonymous-old");
    await h.requests.erasePii("anonymous-old", "2020-01-01T00:00:00Z");
    await h.add("fresh-open");

    const first = await runScheduledMaintenance({ ...SECRETS, DB: h.store.db }, h.store, NOW);
    expect(first).toEqual({
      sent: 0,
      retried: 0,
      deadLettered: 0,
      rejected: 0,
      erased: 1,
      deleted: 1,
    });

    await setStatus(h, {
      id: "fresh-open",
      status: "submitted",
      updatedAt: "2020-01-01T00:00:00Z",
      closedAt: null,
    });
    const sameDay = await runScheduledMaintenance(
      { ...SECRETS, DB: h.store.db },
      h.store,
      new Date(NOW.getTime() + 3_600_000),
    );
    expect(sameDay).toEqual({
      sent: 0,
      retried: 0,
      deadLettered: 0,
      rejected: 0,
      erased: 0,
      deleted: 0,
    });
    expect(await h.requests.findById("fresh-open")).toMatchObject({ status: "submitted" });

    const nextDay = await runScheduledMaintenance(
      { ...SECRETS, DB: h.store.db },
      h.store,
      new Date(NOW.getTime() + 86_400_000),
    );
    expect(nextDay).toEqual({
      sent: 0,
      retried: 0,
      deadLettered: 0,
      rejected: 1,
      erased: 0,
      deleted: 0,
    });
    expect(await h.requests.findById("fresh-open")).toMatchObject({ status: "rejected" });
  });
});
