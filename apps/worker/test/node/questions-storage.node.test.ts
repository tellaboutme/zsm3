import { describe, it, vi } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { memoryBucket } from "./panel-support.ts";
import { SECRETS } from "./request-harness.ts";
import {
  CLOSED_RETENTION_DAYS,
  retentionCutoffs,
  UNANSWERED_RETENTION_DAYS,
} from "../../src/domain/question-lifecycle.ts";
import { runScheduledMaintenance } from "../../src/jobs/retention.ts";
import { seal } from "../../src/questions/sealing.ts";
import { piiCrypto } from "../../src/security/pii-crypto.ts";
import type { Store } from "../../src/storage/database.ts";
import { questionsRepo } from "../../src/storage/questions-repo.ts";

const NOW = new Date("2026-10-22T08:00:00Z");
const crypto = piiCrypto({ PRIMARY: "k".repeat(32) }, "PRIMARY", counterRandom());

function store(): Store {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

interface StoredRow {
  readonly id: string;
  readonly status: string;
  readonly receivedOn: string;
  readonly changedAt: string | null;
}

async function storedAs(
  live: Store,
  { id, status, receivedOn, changedAt }: StoredRow,
): Promise<void> {
  await questionsRepo(live).receive({
    id,
    addressee: "leadership",
    question: await seal(crypto, "question", id, "Pytanie o plan lekcji."),
    formKey: id,
    receivedOn,
  });
  await live.db
    .prepare(
      `UPDATE questions SET status = ?1, changed_at = ?2,
        draft_ciphertext = CASE WHEN ?1 IN ('draft', 'published') THEN x'00' END,
        draft_key_id = CASE WHEN ?1 IN ('draft', 'published') THEN 'PRIMARY' END,
        published_question = CASE WHEN ?1 = 'published' THEN 'P' END,
        published_answer = CASE WHEN ?1 = 'published' THEN 'O' END,
        published_on = CASE WHEN ?1 = 'published' THEN '2025-01-01' END,
        public_slug = CASE WHEN ?1 = 'published' THEN 'abcdefghjkmn' END
        WHERE id = ?3`,
    )
    .bind(status, changedAt, id)
    .run();
}

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("question retention", () => {
  it("deletes stale unanswered and old closed questions but keeps the rest", async ({ expect }) => {
    const live = store();
    await storedAs(live, {
      id: ID(1),
      status: "received",
      receivedOn: "2026-07-24",
      changedAt: null,
    });
    await storedAs(live, {
      id: ID(2),
      status: "received",
      receivedOn: "2026-07-25",
      changedAt: null,
    });
    await storedAs(live, {
      id: ID(3),
      status: "draft",
      receivedOn: "2026-01-01",
      changedAt: "2026-10-01T10:00:00.000Z",
    });
    await storedAs(live, {
      id: ID(4),
      status: "draft",
      receivedOn: "2026-01-01",
      changedAt: "2026-07-20T10:00:00.000Z",
    });
    await storedAs(live, {
      id: ID(5),
      status: "rejected",
      receivedOn: "2026-09-01",
      changedAt: "2026-09-21T07:59:59.000Z",
    });
    await storedAs(live, {
      id: ID(6),
      status: "withdrawn",
      receivedOn: "2026-09-01",
      changedAt: "2026-09-23T00:00:00.000Z",
    });
    await storedAs(live, {
      id: ID(7),
      status: "published",
      receivedOn: "2024-01-01",
      changedAt: "2024-01-02T00:00:00.000Z",
    });

    const removed = await questionsRepo(live).prune(retentionCutoffs(NOW), 100);
    const left = await questionsRepo(live).list({ limit: 50 });

    expect(removed).toBe(3);
    expect(left.map((row) => row.id).toSorted()).toEqual([ID(2), ID(3), ID(6), ID(7)]);
  });

  it("removes in bounded batches", async ({ expect }) => {
    const live = store();
    for (let n = 1; n <= 3; n += 1) {
      await storedAs(live, {
        id: ID(n),
        status: "rejected",
        receivedOn: "2026-01-01",
        changedAt: "2026-01-02T00:00:00.000Z",
      });
    }

    expect(await questionsRepo(live).prune(retentionCutoffs(NOW), 2)).toBe(2);
    expect(await questionsRepo(live).prune(retentionCutoffs(NOW), 2)).toBe(1);
  });

  it("runs on every scheduled maintenance pass", async ({ expect }) => {
    const live = store();
    await storedAs(live, {
      id: ID(1),
      status: "rejected",
      receivedOn: "2026-01-01",
      changedAt: "2026-01-02T00:00:00.000Z",
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await runScheduledMaintenance({ ...SECRETS, DB: live.db, MEDIA: memoryBucket() }, live, NOW);

    expect(await questionsRepo(live).list({ limit: 5 })).toEqual([]);
    vi.restoreAllMocks();
  });

  it("measures the windows in days", ({ expect }) => {
    expect([UNANSWERED_RETENTION_DAYS, CLOSED_RETENTION_DAYS]).toEqual([90, 30]);
    expect(retentionCutoffs(NOW)).toEqual({
      unanswered: "2026-07-24T08:00:00.000Z",
      closed: "2026-09-22T08:00:00.000Z",
    });
  });
});
