import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { requestsRepo, type CreateRequestData } from "../../src/storage/requests-repo.ts";
import { bytesSchema } from "../../src/storage/requests-rows.ts";

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

describe("requestsRepo", () => {
  it("reads binary values from D1 arrays and buffers", ({ expect }) => {
    expect(bytesSchema.parse([1, 2])).toEqual(new Uint8Array([1, 2]));
    expect(bytesSchema.parse(new Uint8Array([3, 4]).buffer)).toEqual(new Uint8Array([3, 4]));
  });
  it("creates a request and reads it back", async ({ expect }) => {
    const repo = requestsRepo(store());
    const outcome = await repo.create(createData({}));

    expect(outcome.kind).toBe("created");
    const record = "record" in outcome ? outcome.record : undefined;
    expect(record).toMatchObject({
      id: "11111111-2222-4333-8444-555555555555",
      type: "STUDENT_ID_RENEWAL",
      status: "submitted",
      staffNote: null,
      closedAt: null,
      piiErasedAt: null,
      createdAt: "2026-10-22T08:00:00.000Z",
    });
    expect(await repo.findById(record?.id ?? "")).toEqual(record);
    expect(await repo.findById("33333333-2222-4333-8444-555555555555")).toBeUndefined();
    expect(await repo.findByTokenHash(createData({}).statusTokenHash)).toEqual(record);
    expect(await repo.findByTokenHash(new Uint8Array(32).fill(9))).toBeUndefined();
  });

  it("reports a duplicate form key with the existing record", async ({ expect }) => {
    const repo = requestsRepo(store());
    await repo.create(createData({}));
    const outcome = await repo.create(
      createData({
        id: "33333333-2222-4333-8444-555555555555",
        statusTokenHash: new Uint8Array(32).fill(9),
      }),
    );

    expect(outcome.kind).toBe("duplicate");
    const record = "record" in outcome ? outcome.record : undefined;
    expect(record?.formKey).toBe("22222222-2222-4333-8444-555555555555");
  });

  it("rethrows a conflict unrelated to the form key", async ({ expect }) => {
    const repo = requestsRepo(store());
    await repo.create(createData({}));
    await expect(
      repo.create(
        createData({
          id: "33333333-2222-4333-8444-555555555555",
          formKey: "44444444-2222-4333-8444-555555555555",
          statusTokenHash: createData({}).statusTokenHash,
        }),
      ),
    ).rejects.toThrow("UNIQUE constraint failed: requests.status_token_hash");
  });

  it("rethrows a form key conflict if the row vanishes before lookup", async ({ expect }) => {
    const original = store();
    const existing = requestsRepo(original);
    await existing.create(createData({}));
    const repo = requestsRepo({
      ...original,
      db: {
        ...original.db,
        prepare: (query) => {
          const statement = original.db.prepare(query);
          if (query.includes("WHERE form_key = ?")) {
            return {
              ...statement,
              bind: (...values) => ({
                ...statement.bind(...values),
                first: async () => Promise.resolve(null),
              }),
            };
          }
          return statement;
        },
      },
    });
    await expect(
      repo.create(
        createData({
          id: "33333333-2222-4333-8444-555555555555",
          statusTokenHash: new Uint8Array(32).fill(9),
        }),
      ),
    ).rejects.toThrow("UNIQUE constraint failed: requests.form_key");
  });

  it("counts open requests per e-mail index", async ({ expect }) => {
    const repo = requestsRepo(store());
    const emailIndex = new Uint8Array(32).fill(7);
    await repo.create(createData({}));

    expect(await repo.countOpenByEmailIndex(emailIndex)).toBe(1);
    await repo.create(
      createData({
        id: "33333333-2222-4333-8444-555555555555",
        formKey: "44444444-2222-4333-8444-555555555555",
      }),
    );
    expect(await repo.countOpenByEmailIndex(emailIndex)).toBe(2);

    await repo.transition("11111111-2222-4333-8444-555555555555", "withdrawn");
    expect(await repo.countOpenByEmailIndex(emailIndex)).toBe(1);
    expect(await repo.countOpenByEmailIndex(new Uint8Array(32).fill(9))).toBe(0);
  });

  it("moves a request through its lifecycle and closes it", async ({ expect }) => {
    const repo = requestsRepo(store());
    await repo.create(createData({}));

    const inProgress = await repo.transition("11111111-2222-4333-8444-555555555555", "in_progress");
    expect(inProgress.status).toBe("in_progress");
    expect(inProgress.closedAt).toBeNull();

    const ready = await repo.transition("11111111-2222-4333-8444-555555555555", "ready");
    expect(ready.updatedAt).toBe("2026-10-22T08:00:00.000Z");

    const collected = await repo.transition("11111111-2222-4333-8444-555555555555", "collected");
    expect(collected.closedAt).toBe("2026-10-22T08:00:00.000Z");

    await expect(
      repo.transition("11111111-2222-4333-8444-555555555555", "withdrawn"),
    ).rejects.toThrow("Invalid request status transition from collected to withdrawn");
    await expect(repo.transition("missing", "ready")).rejects.toThrow("is missing");
  });
});
