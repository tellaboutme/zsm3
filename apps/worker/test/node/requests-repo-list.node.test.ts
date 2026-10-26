import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { requestsRepo, type CreateRequestData } from "../../src/storage/requests-repo.ts";

function tokenHashFor(id: string): Uint8Array {
  return new Uint8Array(32).fill(id.charCodeAt(0));
}

function createData(overrides: Partial<CreateRequestData>): CreateRequestData {
  const id = overrides.id ?? "11111111-2222-4333-8444-555555555555";
  return {
    id,
    type: "STUDENT_ID_RENEWAL",
    piiCiphertext: new Uint8Array([1, 2, 3]),
    piiKeyId: "PRIMARY",
    emailIndex: new Uint8Array(32).fill(7),
    statusTokenHash: tokenHashFor(id),
    formKey: "22222222-2222-4333-8444-555555555555",
    ...overrides,
  };
}

function store() {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

describe("requestsRepo lists and retention", () => {
  it("does not erase a request closed between reading and withdrawal", async ({ expect }) => {
    const current = store();
    const repo = requestsRepo(current);
    await repo.create(createData({}));
    const raced = requestsRepo({
      ...current,
      db: {
        prepare: (sql) => current.db.prepare(sql),
        batch: async (statements) => {
          await current.db
            .prepare("UPDATE requests SET status = 'rejected' WHERE id = ?")
            .bind("11111111-2222-4333-8444-555555555555")
            .run();
          return current.db.batch(statements);
        },
      },
    });
    expect(
      await raced.withdrawAndErase(
        "11111111-2222-4333-8444-555555555555",
        "2026-10-22T09:00:00.000Z",
      ),
    ).toMatchObject({ status: "rejected", piiErasedAt: null });
    expect(await repo.findById("11111111-2222-4333-8444-555555555555")).toMatchObject({
      piiErasedAt: null,
    });
  });
  it("lists requests with optional filters", async ({ expect }) => {
    let now = new Date("2026-10-22T08:00:00Z");
    const repo = requestsRepo({ db: memoryDatabase(), clock: () => now, random: counterRandom() });
    await repo.create(createData({}));
    now = new Date("2026-10-22T08:01:00Z");
    await repo.create(
      createData({
        id: "33333333-2222-4333-8444-555555555555",
        type: "ENROLLMENT_CERTIFICATE",
        formKey: "44444444-2222-4333-8444-555555555555",
      }),
    );

    expect(await repo.list({ limit: 10 })).toHaveLength(2);
    expect(await repo.list({ status: "submitted", limit: 10 })).toHaveLength(2);
    expect(await repo.list({ status: "collected", limit: 10 })).toHaveLength(0);
    expect(await repo.list({ before: "2026-10-22T08:00:00.000Z", limit: 10 })).toHaveLength(0);
    const limited = await repo.list({ limit: 1 });
    expect(limited).toHaveLength(1);
    expect(limited[0]?.type).toBe("ENROLLMENT_CERTIFICATE");
  });

  it("closes inactive requests in a batch only while still open", async ({ expect }) => {
    const repo = requestsRepo(store());
    await repo.create(createData({}));
    await repo.create(
      createData({
        id: "33333333-2222-4333-8444-555555555555",
        type: "ENROLLMENT_CERTIFICATE",
        formKey: "44444444-2222-4333-8444-555555555555",
      }),
    );

    await repo.closeInactive(
      ["11111111-2222-4333-8444-555555555555", "33333333-2222-4333-8444-555555555555"],
      "2026-10-22T09:00:00.000Z",
      "2026-10-22T08:01:00.000Z",
    );
    await repo.closeInactive(
      ["11111111-2222-4333-8444-555555555555"],
      "2026-10-22T10:00:00.000Z",
      "2026-10-22T08:01:00.000Z",
    );

    expect(await repo.findById("11111111-2222-4333-8444-555555555555")).toMatchObject({
      status: "rejected",
      closedAt: "2026-10-22T09:00:00.000Z",
      updatedAt: "2026-10-22T09:00:00.000Z",
    });
  });

  it("erases pii and keeps the row anonymous", async ({ expect }) => {
    const repo = requestsRepo(store());
    await repo.create(createData({}));

    await repo.erasePii("11111111-2222-4333-8444-555555555555", "2026-10-22T09:00:00.000Z");
    const erased = await repo.findById("11111111-2222-4333-8444-555555555555");

    expect(erased).toMatchObject({
      piiCiphertext: null,
      piiKeyId: null,
      emailIndex: null,
      piiErasedAt: "2026-10-22T09:00:00.000Z",
      status: "submitted",
    });
    expect(await repo.countOpenByEmailIndex(new Uint8Array(32).fill(7))).toBe(0);
  });

  it("withdraws and erases in one go", async ({ expect }) => {
    const repo = requestsRepo(store());
    await repo.create(createData({}));

    const withdrawn = await repo.withdrawAndErase(
      "11111111-2222-4333-8444-555555555555",
      "2026-10-22T09:00:00.000Z",
    );
    expect(withdrawn).toMatchObject({
      status: "withdrawn",
      piiCiphertext: null,
      closedAt: "2026-10-22T09:00:00.000Z",
      piiErasedAt: "2026-10-22T09:00:00.000Z",
    });
    await expect(
      repo.withdrawAndErase("11111111-2222-4333-8444-555555555555", "2026-10-22T10:00:00.000Z"),
    ).rejects.toThrow("Invalid request status transition");
  });

  it("deletes only erased rows", async ({ expect }) => {
    const repo = requestsRepo(store());
    await repo.create(createData({}));
    await repo.create(
      createData({
        id: "33333333-2222-4333-8444-555555555555",
        type: "ENROLLMENT_CERTIFICATE",
        formKey: "44444444-2222-4333-8444-555555555555",
      }),
    );
    await repo.erasePii("11111111-2222-4333-8444-555555555555", "2026-10-22T09:00:00.000Z");

    await repo.deleteErased([
      "11111111-2222-4333-8444-555555555555",
      "33333333-2222-4333-8444-555555555555",
    ]);

    expect(await repo.findById("11111111-2222-4333-8444-555555555555")).toBeUndefined();
    expect(await repo.findById("33333333-2222-4333-8444-555555555555")).not.toBeUndefined();
  });

  it("lists inactive, closed and erased selections", async ({ expect }) => {
    const repo = requestsRepo(store());
    await repo.create(createData({}));
    await repo.create(
      createData({
        id: "33333333-2222-4333-8444-555555555555",
        type: "ENROLLMENT_CERTIFICATE",
        formKey: "44444444-2222-4333-8444-555555555555",
      }),
    );

    expect(await repo.listInactive("2026-10-23T08:00:00.000Z", 100)).toHaveLength(2);
    await repo.transition("11111111-2222-4333-8444-555555555555", "rejected");
    expect(await repo.listInactive("2026-10-23T08:00:00.000Z", 100)).toHaveLength(1);
    expect(await repo.listClosedBefore("2026-10-23T08:00:00.000Z", 100)).toHaveLength(1);
    await repo.erasePii("11111111-2222-4333-8444-555555555555", "2026-10-22T09:00:00.000Z");
    expect(await repo.listErasedBefore("2026-10-23T08:00:00.000Z", 100)).toHaveLength(1);
  });
});
