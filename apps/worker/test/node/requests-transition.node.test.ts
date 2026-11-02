import type { RequestStatus } from "@zsm3/contracts/requests";
import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { batchChanges } from "../../src/storage/database.ts";
import { requestsRepo, type CreateRequestData } from "../../src/storage/requests-repo.ts";

const ID = "11111111-2222-4333-8444-555555555555";
const ORIGIN = "https://zsm3.test";
const AUDIT = {
  actorEmail: "sekretariat@zsm3.test",
  action: "requests.transition",
  entity: "requests",
  entityId: ID,
  details: '{"fields":["status"]}',
};

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

async function seeded() {
  const current = store();
  const repo = requestsRepo(current);
  await repo.create(createData());
  const move = async (from: RequestStatus, to: RequestStatus, id = ID) => {
    const transition = repo.transitionStatements({ id, from, to, origin: ORIGIN, audit: AUDIT });
    const changes = batchChanges(await current.db.batch([...transition.statements]));
    return { applied: transition.applied(changes), changes };
  };
  const rows = async (query: string) => (await current.db.prepare(query).all()).results;
  return { repo, move, rows };
}

describe("request transitions with notices", () => {
  it("updates the status, audits it and queues the ready notice in one batch", async ({
    expect,
  }) => {
    const { repo, move, rows } = await seeded();

    expect(await move("submitted", "in_progress")).toEqual({ applied: true, changes: [1, 1] });
    expect(await move("in_progress", "ready")).toEqual({ applied: true, changes: [1, 1, 1] });

    expect(await repo.findById(ID)).toMatchObject({
      status: "ready",
      updatedAt: "2026-10-22T08:00:00.000Z",
      closedAt: null,
    });
    expect(
      await rows("SELECT kind, request_id, origin, attempts, next_attempt_at FROM email_outbox"),
    ).toEqual([
      {
        kind: "READY_NOTICE",
        request_id: ID,
        origin: ORIGIN,
        attempts: 0,
        next_attempt_at: "2026-10-22T08:00:00.000Z",
      },
    ]);
    expect(await rows("SELECT actor_email, action, entity_id FROM audit_log")).toEqual([
      { actor_email: AUDIT.actorEmail, action: AUDIT.action, entity_id: ID },
      { actor_email: AUDIT.actorEmail, action: AUDIT.action, entity_id: ID },
    ]);
  });

  it("gives a repeated attempt with the same timestamp no side effects", async ({ expect }) => {
    const { repo, move, rows } = await seeded();

    expect((await move("submitted", "rejected")).applied).toBe(true);
    expect(await move("submitted", "rejected")).toEqual({ applied: false, changes: [0, 0, 0] });

    expect(await repo.findById(ID)).toMatchObject({ status: "rejected" });
    expect(await rows("SELECT id FROM audit_log")).toHaveLength(1);
    expect(await rows("SELECT kind FROM email_outbox")).toEqual([{ kind: "REJECTED_NOTICE" }]);
  });

  it("withdraws an unsent ready notice when the request leaves ready", async ({ expect }) => {
    const { move, rows } = await seeded();
    await move("submitted", "in_progress");
    await move("in_progress", "ready");

    expect(await move("ready", "rejected")).toEqual({ applied: true, changes: [1, 1, 1, 1] });

    expect(await rows("SELECT kind FROM email_outbox")).toEqual([{ kind: "REJECTED_NOTICE" }]);
  });

  it("keeps a ready notice that was already sent", async ({ expect }) => {
    const { move, rows } = await seeded();
    await move("submitted", "in_progress");
    await move("in_progress", "ready");
    await rows("UPDATE email_outbox SET sent_at = '2026-10-22T08:05:00.000Z'");

    expect(await move("ready", "collected")).toEqual({ applied: true, changes: [1, 0, 1] });

    expect(await rows("SELECT kind FROM email_outbox")).toEqual([{ kind: "READY_NOTICE" }]);
  });

  it("closes the request and queues the rejection notice", async ({ expect }) => {
    const { repo, move, rows } = await seeded();

    await move("submitted", "rejected");

    expect(await repo.findById(ID)).toMatchObject({
      status: "rejected",
      closedAt: "2026-10-22T08:00:00.000Z",
    });
    expect(await rows("SELECT kind FROM email_outbox")).toEqual([{ kind: "REJECTED_NOTICE" }]);
  });

  it("changes nothing when the stored status is no longer the expected one", async ({ expect }) => {
    const { repo, move, rows } = await seeded();
    await repo.withdrawAndErase(ID, "2026-10-22T07:00:00.000Z");

    expect(await move("submitted", "ready")).toEqual({ applied: false, changes: [0, 0, 0] });
    expect(await move("submitted", "collected")).toEqual({ applied: false, changes: [0, 0] });

    expect(await repo.findById(ID)).toMatchObject({ status: "withdrawn" });
    expect(await rows("SELECT id FROM email_outbox")).toHaveLength(0);
    expect(await rows("SELECT id FROM audit_log")).toHaveLength(0);
  });

  it("queues nothing when the request vanished before the batch", async ({ expect }) => {
    const { move, rows } = await seeded();

    expect(await move("submitted", "ready", "99999999-9999-4999-8999-999999999999")).toEqual({
      applied: false,
      changes: [0, 0, 0],
    });

    expect(await rows("SELECT id FROM email_outbox")).toHaveLength(0);
    expect(await rows("SELECT id FROM audit_log")).toHaveLength(0);
  });
});
