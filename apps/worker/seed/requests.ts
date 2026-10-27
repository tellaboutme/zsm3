import { requestPiiSchema, type RequestStatus, type RequestType } from "@zsm3/contracts/requests";

import { emailIndex, type PiiCrypto } from "../src/security/pii-crypto.ts";
import { statusToken, tokenHash } from "../src/security/tokens.ts";
import { batchChanges, timestamp, type Store } from "../src/storage/database.ts";
import { uuidv7 } from "../src/storage/ids.ts";
import { requestsRepo } from "../src/storage/requests-repo.ts";

const INSERT_SEED_REQUEST = `INSERT INTO requests
  (id, type, status, pii_ciphertext, pii_key_id, email_index, status_token_hash, form_key, created_at, updated_at)
  VALUES (?1, ?2, 'submitted', ?3, ?4, ?5, ?6, ?7, ?8, ?8)
  ON CONFLICT(id) DO NOTHING`;

export interface RequestSeedDeps {
  readonly store: Store;
  readonly pii: PiiCrypto;
  readonly emailIndexKey: string;
}

interface RequestSeed {
  readonly id: string;
  readonly type: RequestType;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly className?: string;
  readonly graduationYear?: number;
  readonly status: RequestStatus;
}

const SEEDS: readonly RequestSeed[] = [
  {
    id: "01a1629f-c400-7a3b-88f0-1d351d9882ff",
    type: "STUDENT_ID_RENEWAL",
    firstName: "Jan",
    lastName: "Przykładowy",
    email: "jan.przykladowy@example.com",
    className: "4tp",
    status: "submitted",
  },
  {
    id: "01a1629f-c400-79e1-801b-afb7dcf1c171",
    type: "ENROLLMENT_CERTIFICATE",
    firstName: "Anna",
    lastName: "Przykładowa",
    email: "anna.przykladowa@example.com",
    graduationYear: 2025,
    status: "in_progress",
  },
];

export async function seedRequests(deps: RequestSeedDeps): Promise<number> {
  const requests = requestsRepo(deps.store);
  let created = 0;
  for (const [index, seed] of SEEDS.entries()) {
    const token = statusToken(deps.store.random);
    const pii = requestPiiSchema.parse({
      firstName: seed.firstName,
      lastName: seed.lastName,
      email: seed.email,
      className: seed.className,
      graduationYear: seed.graduationYear,
      statusToken: token,
    });
    const encrypted = await deps.pii.encrypt(JSON.stringify(pii), seed.id);
    const [inserted] = batchChanges(
      await deps.store.db.batch([
        deps.store.db
          .prepare(INSERT_SEED_REQUEST)
          .bind(
            seed.id,
            seed.type,
            encrypted.ciphertext,
            encrypted.keyId,
            await emailIndex(deps.emailIndexKey, seed.email),
            await tokenHash(token),
            uuidv7(deps.store.clock().getTime() + index + 1, deps.store.random),
            timestamp(deps.store.clock),
          ),
      ]),
    );
    if (inserted === 0) continue;
    if (seed.status !== "submitted") {
      await requests.transition(seed.id, seed.status);
    }
    created += 1;
  }
  return created;
}
