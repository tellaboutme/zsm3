import type { RequestStatus } from "@zsm3/contracts/requests";

import { staffMember } from "./panel-fixtures.ts";
import { piiCrypto } from "../../src/security/pii-crypto.ts";
import type { Store } from "../../src/storage/database.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";
import { requestsRepo } from "../../src/storage/requests-repo.ts";

export const ADMIN = staffMember("admin@zsm3.test", "admin", true);
export const SECRETARIAT = staffMember("sekretariat@zsm3.test", "secretariat", true);
export const EDITOR = staffMember("redaktor@zsm3.test", "editor", true);

const PII_SECRET = "a".repeat(32);
const cryptoHelper = piiCrypto({ PRIMARY: PII_SECRET }, "PRIMARY", cryptoRandom);

const SAMPLE_PII = JSON.stringify({
  firstName: "Jan",
  lastName: "Kowalski",
  className: "4ta",
  email: "jan.kowalski@zsm3.test",
  note: "Prosze o szybkie wydanie",
  statusToken: "b".repeat(43),
});

const NEXT_STEPS: Readonly<Record<RequestStatus, readonly RequestStatus[]>> = {
  submitted: [],
  in_progress: ["in_progress"],
  ready: ["in_progress", "ready"],
  collected: ["in_progress", "ready", "collected"],
  rejected: ["rejected"],
  withdrawn: ["withdrawn"],
};

function storeAt(env: Env, at: string): Store {
  return { db: env.DB, clock: () => new Date(at), random: cryptoRandom };
}

export async function seedRequest(
  env: Env,
  id: string,
  options: {
    readonly at?: string;
    readonly status?: RequestStatus;
    readonly erasedAt?: string;
  } = {},
): Promise<void> {
  const at = options.at ?? "2026-10-22T08:00:00.000Z";
  const repo = requestsRepo(storeAt(env, at));
  const encrypted = await cryptoHelper.encrypt(SAMPLE_PII, id);
  await repo.create({
    id,
    type: "STUDENT_ID_RENEWAL",
    piiCiphertext: encrypted.ciphertext,
    piiKeyId: encrypted.keyId,
    emailIndex: cryptoRandom(32),
    statusTokenHash: cryptoRandom(32),
    formKey: crypto.randomUUID(),
  });
  for (const step of NEXT_STEPS[options.status ?? "submitted"]) {
    await repo.transition(id, step);
  }
  if (options.erasedAt !== undefined) {
    await repo.erasePii(id, options.erasedAt);
  }
}

export async function outboxFor(env: Env, requestId: string): Promise<readonly unknown[]> {
  const rows = await env.DB.prepare("SELECT kind, origin FROM email_outbox WHERE request_id = ?")
    .bind(requestId)
    .all();
  return rows.results;
}

export async function storedStatus(env: Env, requestId: string): Promise<unknown> {
  const rows = await env.DB.prepare(
    "SELECT status, updated_at, closed_at FROM requests WHERE id = ?",
  )
    .bind(requestId)
    .all();
  return rows.results[0];
}
