import { afterEach, describe, it, vi } from "vitest";
import { z } from "zod";

import { harness, NOW, SECRETS, type Harness } from "./maintenance-harness.ts";
import { counterRandom, FIXED_CLOCK } from "./memory-database.ts";
import { MissingSecretError } from "../../src/env.ts";
import { runScheduledMaintenance } from "../../src/jobs/retention.ts";
import { seal } from "../../src/questions/sealing.ts";
import { piiCrypto } from "../../src/security/pii-crypto.ts";
import { firstRow, type SqlDatabase, type Store } from "../../src/storage/database.ts";
import { questionsRepo } from "../../src/storage/questions-repo.ts";
import { PRUNE_QUESTIONS } from "../../src/storage/questions-sql.ts";
import { PRUNE_RATE_LIMITS } from "../../src/storage/rate-limits-sql.ts";

const STALE = "Pytanie, które powinno zniknąć po 90 dniach.";
const crypto = piiCrypto({ PRIMARY: "q".repeat(32) }, "PRIMARY", counterRandom());

afterEach(() => {
  vi.restoreAllMocks();
});

async function staleQuestion(h: Harness, id: string, receivedOn = "2026-01-05"): Promise<void> {
  await questionsRepo(h.store).receive({
    id,
    addressee: "psychologist",
    question: await seal(crypto, "question", id, STALE),
    formKey: id,
    receivedOn,
  });
}

async function staleRateLimit(h: Harness): Promise<void> {
  await h.store.db
    .prepare("INSERT INTO rate_limits (key_hash, window_started_at, count) VALUES (?, ?, 1)")
    .bind(new Uint8Array([7, 7]), "2020-01-01T00:00:00Z")
    .run();
}

async function marker(h: Harness): Promise<string | undefined> {
  const row = await firstRow(
    h.store.db.prepare("SELECT last_run_date FROM cron_state WHERE job = 'retention'"),
    z.object({ last_run_date: z.string() }),
  );
  return row?.last_run_date;
}

async function counts(
  h: Harness,
): Promise<{ questions: number | undefined; rateLimits: number | undefined }> {
  const read = async (query: string) =>
    (await firstRow(h.store.db.prepare(query), z.object({ total: z.number() })))?.total;
  return {
    questions: await read("SELECT count(*) AS total FROM questions"),
    rateLimits: await read("SELECT count(*) AS total FROM rate_limits"),
  };
}

function failing(
  db: SqlDatabase,
  broken: string,
  fault: unknown = new TypeError("D1 unavailable"),
): SqlDatabase {
  return {
    prepare: (query) => {
      if (query === broken) {
        throw fault;
      }
      return db.prepare(query);
    },
    batch: async (statements) => db.batch(statements),
  };
}

const ID = "00000000-0000-4000-8000-000000000101";

describe("scheduled housekeeping without e-wniosek secrets", () => {
  it("still deletes expired questions and rate limits, then reports the missing secret", async ({
    expect,
  }) => {
    const h = harness();
    await staleQuestion(h, ID);
    await staleRateLimit(h);
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(runScheduledMaintenance({ DB: h.store.db }, h.store, NOW)).rejects.toThrow(
      MissingSecretError,
    );

    expect(await counts(h)).toEqual({ questions: 0, rateLimits: 0 });
    expect(logged.mock.calls.flat().join(" ")).not.toContain("zniknąć");
  });

  it("runs again on every tick without e-wniosek and stays idempotent", async ({ expect }) => {
    const h = harness();
    await staleQuestion(h, ID);
    const env = { DB: h.store.db };

    await expect(runScheduledMaintenance(env, h.store, NOW)).rejects.toThrow(MissingSecretError);
    await staleQuestion(h, "00000000-0000-4000-8000-000000000102");
    await expect(runScheduledMaintenance(env, h.store, NOW)).rejects.toThrow(MissingSecretError);
    await expect(runScheduledMaintenance(env, h.store, NOW)).rejects.toThrow(MissingSecretError);

    expect((await counts(h)).questions).toBe(0);
  });
});

describe("scheduled housekeeping with e-wniosek configured", () => {
  it("prunes questions and still applies the request retention once per day", async ({
    expect,
  }) => {
    const h = harness();
    await staleQuestion(h, ID);
    await staleQuestion(h, "00000000-0000-4000-8000-000000000103", "2026-10-20");
    const env = { ...SECRETS, DB: h.store.db };

    const first = await runScheduledMaintenance(env, h.store, NOW);
    const second = await runScheduledMaintenance(env, h.store, NOW);

    expect([first.rejected, second.rejected]).toEqual([0, 0]);
    expect(await marker(h)).toBe("2026-10-22");
    expect((await counts(h)).questions).toBe(1);
  });
});

describe("a transient database failure in one cleanup task", () => {
  it("does not stop the other tasks or the request work, and is reported", async ({ expect }) => {
    const h = harness();
    await staleQuestion(h, ID);
    await staleRateLimit(h);
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store: Store = {
      db: failing(h.store.db, PRUNE_QUESTIONS),
      clock: FIXED_CLOCK,
      random: counterRandom(),
    };

    await expect(runScheduledMaintenance({ ...SECRETS, DB: store.db }, store, NOW)).rejects.toThrow(
      "D1 unavailable",
    );

    expect(await counts(h)).toEqual({ questions: 1, rateLimits: 0 });
    expect(await marker(h)).toBe("2026-10-22");
    expect(logged.mock.calls).toEqual([
      [JSON.stringify({ event: "housekeeping_failed", task: "questions", errorName: "TypeError" })],
    ]);
  });

  it("recovers on the next tick once the database answers again", async ({ expect }) => {
    const h = harness();
    await staleQuestion(h, ID);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken: Store = {
      db: failing(h.store.db, PRUNE_RATE_LIMITS),
      clock: FIXED_CLOCK,
      random: counterRandom(),
    };

    await expect(runScheduledMaintenance({ DB: broken.db }, broken, NOW)).rejects.toThrow(
      MissingSecretError,
    );
    expect((await counts(h)).questions).toBe(0);
    await staleRateLimit(h);
    await expect(runScheduledMaintenance({ DB: h.store.db }, h.store, NOW)).rejects.toThrow(
      MissingSecretError,
    );
    expect((await counts(h)).rateLimits).toBe(0);
  });
});

it("names a failure that is not an Error without exposing it", async ({ expect }) => {
  const h = harness();
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = failing(h.store.db, PRUNE_QUESTIONS, "opaque D1 fault");
  const store: Store = { db, clock: FIXED_CLOCK, random: counterRandom() };

  await expect(runScheduledMaintenance({ ...SECRETS, DB: db }, store, NOW)).rejects.toBe(
    "opaque D1 fault",
  );
  expect(logged.mock.calls).toEqual([
    [JSON.stringify({ event: "housekeeping_failed", task: "questions", errorName: "unknown" })],
  ]);
});
