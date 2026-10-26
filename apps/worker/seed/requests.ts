import { requestPiiSchema, type RequestStatus, type RequestType } from "@zsm3/contracts/requests";

import { emailIndex, type PiiCrypto } from "../src/security/pii-crypto.ts";
import { statusToken, tokenHash } from "../src/security/tokens.ts";
import type { Store } from "../src/storage/database.ts";
import { uuidv7 } from "../src/storage/ids.ts";
import { requestsRepo } from "../src/storage/requests-repo.ts";

export interface RequestSeedDeps {
  readonly store: Store;
  readonly pii: PiiCrypto;
  readonly emailIndexKey: string;
}

interface RequestSeed {
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
    type: "STUDENT_ID_RENEWAL",
    firstName: "Jan",
    lastName: "Przykładowy",
    email: "jan.przykladowy@example.com",
    className: "4tp",
    status: "submitted",
  },
  {
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
  for (const [index, seed] of SEEDS.entries()) {
    const id = uuidv7(deps.store.clock().getTime() + index, deps.store.random);
    const token = statusToken(deps.store.random);
    const pii = requestPiiSchema.parse({
      firstName: seed.firstName,
      lastName: seed.lastName,
      email: seed.email,
      className: seed.className,
      graduationYear: seed.graduationYear,
      statusToken: token,
    });
    const encrypted = await deps.pii.encrypt(JSON.stringify(pii), id);
    const outcome = await requests.create({
      id,
      type: seed.type,
      piiCiphertext: encrypted.ciphertext,
      piiKeyId: encrypted.keyId,
      emailIndex: await emailIndex(deps.emailIndexKey, seed.email),
      statusTokenHash: await tokenHash(token),
      formKey: uuidv7(deps.store.clock().getTime() + index + 1, deps.store.random),
    });
    if (seed.status !== "submitted") {
      await requests.transition(outcome.record.id, seed.status);
    }
  }
  return SEEDS.length;
}
