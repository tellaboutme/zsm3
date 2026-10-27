import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { requestsConfig, type RequestsSecretEnv } from "../../src/env.ts";
import type { MaintenanceDeps } from "../../src/jobs/retention.ts";
import type { EmailSender } from "../../src/mail/email-sender.ts";
import { emailIndex, piiCrypto } from "../../src/security/pii-crypto.ts";
import { statusToken, tokenHash } from "../../src/security/tokens.ts";
import type { Store } from "../../src/storage/database.ts";
import { uuidv7 } from "../../src/storage/ids.ts";
import { outboxRepo } from "../../src/storage/outbox-repo.ts";
import { requestsRepo } from "../../src/storage/requests-repo.ts";

export const SECRETS: RequestsSecretEnv = {
  PII_KEY_PRIMARY: "primary-key-0123456789-0123456789-0123456789",
  EMAIL_INDEX_KEY: "email-index-key-0123456789-0123456789",
  RATE_LIMIT_SALT: "rate-limit-salt-0123456789-01234567890",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  TURNSTILE_SITE_KEY: "turnstile-site",
  BREVO_API_KEY: "brevo-key",
  STATUS_EMAIL_FROM: "no-reply@zespolszkolmechanicznych.edu.pl",
  SECRETARIAT_EMAIL: "u@zespolszkolmechanicznych.edu.pl",
};

export const NOW = new Date("2026-10-22T08:00:00Z");

export interface Harness {
  readonly store: Store;
  readonly requests: ReturnType<typeof requestsRepo>;
  readonly outbox: ReturnType<typeof outboxRepo>;
  readonly deps: MaintenanceDeps;
  readonly add: (id: string) => Promise<void>;
}

export function harness(): Harness {
  const store: Store = { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
  const requests = requestsRepo(store);
  const outbox = outboxRepo(store);
  const config = requestsConfig(SECRETS);
  const crypto = piiCrypto(config.piiKeys, config.activePiiKeyId, store.random);
  const sender: EmailSender = { send: async () => Promise.resolve(undefined) };
  let formKeys = 0;
  const add = async (id: string): Promise<void> => {
    const token = statusToken(store.random);
    await requests.create({
      id,
      type: "STUDENT_ID_RENEWAL",
      piiCiphertext: (
        await crypto.encrypt(
          JSON.stringify({
            firstName: "Jan",
            lastName: "Przykładowy",
            email: `${id}@example.com`,
            className: "4tp",
            statusToken: token,
          }),
          id,
        )
      ).ciphertext,
      piiKeyId: "PRIMARY",
      emailIndex: await emailIndex(config.emailIndexKey, `${id}@example.com`),
      statusTokenHash: await tokenHash(token),
      formKey: uuidv7(store.clock().getTime() + (formKeys += 1), store.random),
    });
  };
  return { store, requests, outbox, deps: { requests, outbox, crypto, sender, config }, add };
}

interface StatusPatch {
  readonly id: string;
  readonly status: string;
  readonly updatedAt: string;
  readonly closedAt: string | null;
}

export async function setStatus(h: Harness, patch: StatusPatch): Promise<void> {
  await h.store.db
    .prepare("UPDATE requests SET status = ?1, updated_at = ?2, closed_at = ?3 WHERE id = ?4")
    .bind(patch.status, patch.updatedAt, patch.closedAt, patch.id)
    .run();
}
