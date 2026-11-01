import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { requestsRepo, type CreateRequestData } from "../../src/storage/requests-repo.ts";

const ID = "11111111-2222-4333-8444-555555555555";
const ORIGIN = "https://zsm3.test";

function store() {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

function createData(): CreateRequestData {
  return {
    id: ID,
    type: "STUDENT_ID_RENEWAL",
    piiCiphertext: new Uint8Array([1, 2, 3]),
    piiKeyId: "PRIMARY",
    emailIndex: new Uint8Array(32).fill(7),
    statusTokenHash: new Uint8Array(32).fill(9),
    formKey: "22222222-2222-4333-8444-555555555555",
  };
}

describe("request transitions with notices", () => {
  it("updates the status and queues the ready notice in one batch", async ({ expect }) => {
    const current = store();
    const repo = requestsRepo(current);
    await repo.create(createData());

    await current.db.batch([...repo.transitionStatements(ID, "ready", ORIGIN)]);

    expect(await repo.findById(ID)).toMatchObject({
      status: "ready",
      updatedAt: "2026-10-22T08:00:00.000Z",
      closedAt: null,
    });
    const outbox = await current.db
      .prepare("SELECT kind, request_id, origin, attempts, next_attempt_at FROM email_outbox")
      .all();
    expect(outbox.results).toEqual([
      {
        kind: "READY_NOTICE",
        request_id: ID,
        origin: ORIGIN,
        attempts: 0,
        next_attempt_at: "2026-10-22T08:00:00.000Z",
      },
    ]);
  });

  it("closes the request and queues the rejection notice", async ({ expect }) => {
    const current = store();
    const repo = requestsRepo(current);
    await repo.create(createData());

    await current.db.batch([...repo.transitionStatements(ID, "rejected", ORIGIN)]);

    expect(await repo.findById(ID)).toMatchObject({
      status: "rejected",
      closedAt: "2026-10-22T08:00:00.000Z",
    });
    const outbox = await current.db.prepare("SELECT kind FROM email_outbox").all();
    expect(outbox.results).toEqual([{ kind: "REJECTED_NOTICE" }]);
  });

  it("queues no notice for statuses other than ready and rejected", async ({ expect }) => {
    const current = store();
    const repo = requestsRepo(current);
    await repo.create(createData());

    await current.db.batch([...repo.transitionStatements(ID, "in_progress", ORIGIN)]);
    await current.db.batch([...repo.transitionStatements(ID, "withdrawn", ORIGIN)]);

    expect(await repo.findById(ID)).toMatchObject({ status: "withdrawn" });
    expect((await current.db.prepare("SELECT id FROM email_outbox").all()).results).toHaveLength(0);
  });

  it("queues nothing when the request vanished before the batch", async ({ expect }) => {
    const current = store();
    const repo = requestsRepo(current);

    await current.db.batch([
      ...repo.transitionStatements("99999999-9999-4999-8999-999999999999", "ready", ORIGIN),
    ]);

    expect((await current.db.prepare("SELECT id FROM email_outbox").all()).results).toHaveLength(0);
  });
});
