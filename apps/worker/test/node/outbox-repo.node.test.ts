import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import type { Store } from "../../src/storage/database.ts";
import { outboxRepo, MAX_OUTBOX_ATTEMPTS, type OutboxRow } from "../../src/storage/outbox-repo.ts";
import { requestsRepo } from "../../src/storage/requests-repo.ts";

const REQUEST_ID = "11111111-2222-4333-8444-555555555555";

function store(): Store {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

async function storeWithRequest(): Promise<Store> {
  const base = store();
  await requestsRepo(base).create({
    id: REQUEST_ID,
    type: "STUDENT_ID_RENEWAL",
    piiCiphertext: new Uint8Array([1, 2, 3]),
    piiKeyId: "PRIMARY",
    emailIndex: new Uint8Array(32).fill(7),
    statusTokenHash: new Uint8Array(32).fill(8),
    formKey: "22222222-2222-4333-8444-555555555555",
  });
  return base;
}

function row(overrides: Partial<OutboxRow>): OutboxRow {
  return {
    id: "outbox-1",
    kind: "SUBMISSION_CONFIRMATION",
    requestId: "11111111-2222-4333-8444-555555555555",
    origin: "https://zsm3.test",
    attempts: 0,
    nextAttemptAt: "2026-10-22T08:00:00.000Z",
    sentAt: null,
    failedAt: null,
    leaseOwner: null,
    leaseUntil: null,
    ...overrides,
  };
}

describe("outboxRepo", () => {
  it("leases due messages to one consumer and scopes acknowledgements to the owner", async ({
    expect,
  }) => {
    const base = await storeWithRequest();
    const repo = outboxRepo(base);
    await repo.enqueue([{ kind: "READY_NOTICE", requestId: REQUEST_ID, origin: null }]);
    const now = new Date("2026-10-22T09:00:00.000Z");
    const [owned] = await repo.claim(now, 1);
    expect(owned?.leaseOwner).not.toBeNull();
    expect(await outboxRepo(base).claim(now, 1)).toHaveLength(0);
    const [reclaimed] = await outboxRepo(base).claim(new Date("2026-10-22T09:02:01.000Z"), 1);
    expect(reclaimed?.leaseOwner).not.toBe(owned?.leaseOwner);
    expect(await repo.markSent(owned ?? row({}))).toBe(false);
    expect(await repo.markSent(row({}))).toBe(false);
    expect(await repo.markFailed(row({}), "unclaimed")).toBe("stale");
    expect(await repo.markFailed(owned ?? row({}), "late_failure")).toBe("stale");
    expect(await repo.markSent(reclaimed ?? row({}))).toBe(true);
    expect(await repo.claim(new Date("2026-10-22T09:05:00.000Z"), 1)).toHaveLength(0);
  });

  it("removes pending mail and failures when an erased request is deleted", async ({ expect }) => {
    const base = await storeWithRequest();
    const repo = outboxRepo(base);
    await repo.enqueue([{ kind: "READY_NOTICE", requestId: REQUEST_ID, origin: null }]);
    const [claimed] = await repo.claim(new Date("2026-10-22T09:00:00.000Z"), 1);
    await base.db
      .prepare(
        "INSERT INTO outbox_failures (id, message_kind, request_id, error_code, at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind("failure-1", "READY_NOTICE", REQUEST_ID, "test", "2026-10-22T08:00:00Z")
      .run();
    const requests = requestsRepo(base);
    await requests.erasePii(REQUEST_ID, "2020-01-01T00:00:00Z");
    await requests.deleteErased([REQUEST_ID]);
    expect(await repo.markSent(claimed ?? row({}))).toBe(false);
    expect(
      (
        await base.db
          .prepare("SELECT id FROM email_outbox WHERE request_id = ?")
          .bind(REQUEST_ID)
          .all()
      ).results,
    ).toHaveLength(0);
    expect(
      (
        await base.db
          .prepare("SELECT id FROM outbox_failures WHERE request_id = ?")
          .bind(REQUEST_ID)
          .all()
      ).results,
    ).toHaveLength(0);
  });

  it("enqueues drafts and returns the due ones in order", async ({ expect }) => {
    const repo = outboxRepo(await storeWithRequest());
    await repo.enqueue([
      {
        kind: "SUBMISSION_CONFIRMATION",
        requestId: "11111111-2222-4333-8444-555555555555",
        origin: "https://zsm3.test",
      },
      {
        kind: "SECRETARIAT_NOTICE",
        requestId: "11111111-2222-4333-8444-555555555555",
        origin: null,
      },
    ]);

    const due = await repo.due("2026-10-22T09:00:00.000Z", 10);
    expect(due).toHaveLength(2);
    expect(due[0]).toMatchObject({ kind: "SUBMISSION_CONFIRMATION", attempts: 0, sentAt: null });
    expect(due[1]).toMatchObject({ kind: "SECRETARIAT_NOTICE", origin: null });
    expect(await repo.due("2026-10-22T07:00:00.000Z", 10)).toHaveLength(0);
    expect(await repo.due("2026-10-22T09:00:00.000Z", 1)).toHaveLength(1);
  });

  it("marks rows as sent and stops returning them", async ({ expect }) => {
    const repo = outboxRepo(await storeWithRequest());
    await repo.enqueue([
      {
        kind: "SUBMISSION_CONFIRMATION",
        requestId: "11111111-2222-4333-8444-555555555555",
        origin: null,
      },
    ]);
    const [due] = await repo.claim(new Date("2026-10-22T09:00:00.000Z"), 10);

    expect(await repo.markSent(due ?? row({}))).toBe(true);
    expect(await repo.due("2026-10-22T09:00:00.000Z", 10)).toHaveLength(0);
    const sent = await repo.due("2026-10-22T08:00:00.000Z", 0);
    expect(sent).toHaveLength(0);
  });

  it("retries failures with a backoff and dead-letters the last one", async ({ expect }) => {
    const repo = outboxRepo(await storeWithRequest());
    await repo.enqueue([
      {
        kind: "SUBMISSION_CONFIRMATION",
        requestId: "11111111-2222-4333-8444-555555555555",
        origin: null,
      },
    ]);
    for (const attempt of [1, 2, 3, 4]) {
      const [due] = await repo.claim(new Date("2026-10-22T09:00:00.000Z"), 10);
      const outcome = await repo.markFailed(due ?? row({}), "brevo_status_500");
      expect(outcome).toBe("retried");
      const backoffMs = 2 ** attempt * 60_000;
      const [next] = await repo.due("2026-10-22T23:00:00.000Z", 10);
      expect(new Date(next?.nextAttemptAt ?? "").getTime()).toBe(
        new Date("2026-10-22T08:00:00.000Z").getTime() + backoffMs,
      );
    }

    const [last] = await repo.claim(new Date("2026-10-22T23:00:00.000Z"), 10);
    const outcome = await repo.markFailed(last ?? row({}), "brevo_unreachable");
    expect(outcome).toBe("dead");
    expect(await repo.due("2026-10-23T09:00:00.000Z", 10)).toHaveLength(0);
    expect(MAX_OUTBOX_ATTEMPTS).toBe(5);
  });

  it("removes every row of a request", async ({ expect }) => {
    const repo = outboxRepo(await storeWithRequest());
    await repo.enqueue([
      {
        kind: "SUBMISSION_CONFIRMATION",
        requestId: "11111111-2222-4333-8444-555555555555",
        origin: null,
      },
    ]);
    const [due] = await repo.claim(new Date("2026-10-22T09:00:00.000Z"), 10);
    await repo.markFailed(due ?? row({}), "brevo_status_500");

    await repo.deleteForRequest("11111111-2222-4333-8444-555555555555");
    expect(await repo.due("2026-10-23T09:00:00.000Z", 10)).toHaveLength(0);
  });
});
