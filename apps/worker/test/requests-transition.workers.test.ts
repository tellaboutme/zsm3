import type { RequestStatus } from "@zsm3/contracts/requests";
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, describe, it } from "vitest";

import { batchChanges, type Store } from "../src/storage/database.ts";
import { cryptoRandom } from "../src/storage/ids.ts";
import { requestsRepo } from "../src/storage/requests-repo.ts";

const CLOCK = (): Date => new Date("2026-10-22T08:00:00Z");
const STORE: Store = { db: env.DB, clock: CLOCK, random: cryptoRandom };
const ORIGIN = "https://zsm3.test";

function audit(id: string) {
  return {
    actorEmail: "sekretariat@zsm3.test",
    action: "requests.transition",
    entity: "requests",
    entityId: id,
    details: '{"fields":["status"]}',
  };
}

async function seed(id: string): Promise<void> {
  await requestsRepo(STORE).create({
    id,
    type: "STUDENT_ID_RENEWAL",
    piiCiphertext: new Uint8Array([1, 2, 3]),
    piiKeyId: "PRIMARY",
    emailIndex: cryptoRandom(32),
    statusTokenHash: cryptoRandom(32),
    formKey: crypto.randomUUID(),
  });
}

async function attempt(id: string, from: RequestStatus, to: RequestStatus) {
  const repo = requestsRepo(STORE);
  const transition = repo.transitionStatements({ id, from, to, origin: ORIGIN, audit: audit(id) });
  const changes = batchChanges(await STORE.db.batch([...transition.statements]));
  return { applied: transition.applied(changes), changes };
}

async function sideEffects(id: string) {
  const audits = await env.DB.prepare("SELECT id FROM audit_log WHERE entity_id = ?")
    .bind(id)
    .all();
  const outbox = await env.DB.prepare("SELECT kind FROM email_outbox WHERE request_id = ?")
    .bind(id)
    .all();
  return { audits: audits.results.length, outbox: outbox.results };
}

describe("staff request transitions on D1", () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  });

  it("gives a stale attempt with the same timestamp no side effects", async ({ expect }) => {
    const id = "aaaaaaaa-0000-4000-8000-000000000001";
    await seed(id);

    expect(await attempt(id, "submitted", "rejected")).toEqual({
      applied: true,
      changes: [1, 1, 1],
    });
    expect(await attempt(id, "submitted", "rejected")).toEqual({
      applied: false,
      changes: [0, 0, 0],
    });

    expect(await sideEffects(id)).toEqual({ audits: 1, outbox: [{ kind: "REJECTED_NOTICE" }] });
  });

  it("applies exactly one of two concurrent attempts", async ({ expect }) => {
    const id = "aaaaaaaa-0000-4000-8000-000000000002";
    await seed(id);

    const results = await Promise.all([
      attempt(id, "submitted", "rejected"),
      attempt(id, "submitted", "rejected"),
    ]);

    expect(results.map((result) => Number(result.applied)).toSorted((a, b) => a - b)).toEqual([
      0, 1,
    ]);
    expect(await sideEffects(id)).toEqual({ audits: 1, outbox: [{ kind: "REJECTED_NOTICE" }] });
  });

  it("never revives a withdrawn request or its erased data", async ({ expect }) => {
    const id = "aaaaaaaa-0000-4000-8000-000000000003";
    await seed(id);
    await requestsRepo(STORE).withdrawAndErase(id, "2026-10-22T07:00:00.000Z");

    expect(await attempt(id, "submitted", "ready")).toEqual({ applied: false, changes: [0, 0, 0] });

    expect(await requestsRepo(STORE).findById(id)).toMatchObject({
      status: "withdrawn",
      piiCiphertext: null,
      piiKeyId: null,
    });
    expect(await sideEffects(id)).toEqual({ audits: 0, outbox: [] });
  });
});
