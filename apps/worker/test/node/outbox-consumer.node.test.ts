import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { requestsConfig, type RequestsSecretEnv } from "../../src/env.ts";
import {
  EmailDeliveryError,
  type EmailMessage,
  type EmailSender,
} from "../../src/mail/email-sender.ts";
import { drainOutbox, MAX_DRAIN, type DrainDeps } from "../../src/mail/outbox-consumer.ts";
import { piiCrypto } from "../../src/security/pii-crypto.ts";
import { statusToken } from "../../src/security/tokens.ts";
import type { Store } from "../../src/storage/database.ts";
import { outboxRepo } from "../../src/storage/outbox-repo.ts";
import { requestsRepo } from "../../src/storage/requests-repo.ts";

const REQUEST_ID = "11111111-2222-4333-8444-555555555555";

const SECRETS: RequestsSecretEnv = {
  PII_KEY_PRIMARY: "primary-key-0123456789-0123456789-0123456789",
  EMAIL_INDEX_KEY: "email-index-key-0123456789-0123456789",
  RATE_LIMIT_SALT: "rate-limit-salt-0123456789-01234567890",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  TURNSTILE_SITE_KEY: "turnstile-site",
  BREVO_API_KEY: "brevo-key",
  STATUS_EMAIL_FROM: "no-reply@zespolszkolmechanicznych.edu.pl",
  SECRETARIAT_EMAIL: "u@zespolszkolmechanicznych.edu.pl",
};

interface Harness {
  readonly deps: DrainDeps;
  readonly store: Store;
  readonly sent: EmailMessage[];
  readonly failEvery: { value: boolean };
}

async function harness(overrides: { readonly sender?: EmailSender } = {}): Promise<Harness> {
  const store: Store = { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
  const requests = requestsRepo(store);
  const outbox = outboxRepo(store);
  const config = requestsConfig(SECRETS);
  const crypto = piiCrypto(config.piiKeys, config.activePiiKeyId, store.random);
  const sent: EmailMessage[] = [];
  const failEvery = { value: false };
  const sender: EmailSender = overrides.sender ?? {
    send: async (message) => {
      if (failEvery.value) {
        return Promise.reject(new EmailDeliveryError("brevo_status_500"));
      }
      sent.push(message);
      return Promise.resolve(undefined);
    },
  };
  await requests.create({
    id: REQUEST_ID,
    type: "STUDENT_ID_RENEWAL",
    piiCiphertext: (
      await crypto.encrypt(
        JSON.stringify({
          firstName: "Jan",
          lastName: "Przykładowy",
          email: "jan@example.com",
          className: "4tp",
          statusToken: statusToken(store.random),
        }),
        REQUEST_ID,
      )
    ).ciphertext,
    piiKeyId: "PRIMARY",
    emailIndex: new Uint8Array(32).fill(7),
    statusTokenHash: new Uint8Array(32).fill(8),
    formKey: "22222222-2222-4333-8444-555555555555",
  });
  return { store, sent, failEvery, deps: { requests, outbox, crypto, sender, config } };
}

const NOW = new Date("2026-10-22T09:00:00Z");

describe("drainOutbox", () => {
  it("does not send claimed personal data withdrawn just before delivery", async ({ expect }) => {
    const h = await harness();
    await h.deps.outbox.enqueue([
      { kind: "SUBMISSION_CONFIRMATION", requestId: REQUEST_ID, origin: "https://zsm3.test" },
    ]);
    const outbox: DrainDeps["outbox"] = {
      ...h.deps.outbox,
      active: async (row) => {
        await h.deps.requests.withdrawAndErase(REQUEST_ID, NOW.toISOString());
        return h.deps.outbox.active(row);
      },
    };
    expect((await drainOutbox({ ...h.deps, outbox }, NOW, 1)).sent).toBe(0);
    expect(h.sent).toHaveLength(0);
  });
  it("does not count an acknowledgement after cancellation during delivery", async ({ expect }) => {
    const h = await harness();
    await h.deps.outbox.enqueue([
      { kind: "SECRETARIAT_NOTICE", requestId: REQUEST_ID, origin: null },
    ]);
    const deps: DrainDeps = {
      ...h.deps,
      sender: {
        send: async () => {
          await h.deps.outbox.deleteForRequest(REQUEST_ID);
        },
      },
    };
    expect(await drainOutbox(deps, NOW, 1)).toEqual({ sent: 0, retried: 0, deadLettered: 0 });
  });

  it("sends the confirmation to the pupil and the notice to the secretariat", async ({
    expect,
  }) => {
    const h = await harness();
    await h.deps.outbox.enqueue([
      { kind: "SUBMISSION_CONFIRMATION", requestId: REQUEST_ID, origin: "https://zsm3.test" },
      { kind: "SECRETARIAT_NOTICE", requestId: REQUEST_ID, origin: null },
    ]);

    const result = await drainOutbox(h.deps, NOW, MAX_DRAIN);

    expect(result).toEqual({ sent: 2, retried: 0, deadLettered: 0 });
    expect(h.sent).toHaveLength(2);
    expect(h.sent[0]).toMatchObject({ to: "jan@example.com", from: SECRETS.STATUS_EMAIL_FROM });
    expect(h.sent[0]?.text).toContain("https://zsm3.test/e-wniosek/status#");
    expect(h.sent[1]).toMatchObject({ to: SECRETS.SECRETARIAT_EMAIL });
    expect(h.sent[1]?.text).not.toContain("@");
    expect(await h.deps.outbox.due(NOW.toISOString(), 10)).toHaveLength(0);
  });

  it("retries a delivery failure with its error code", async ({ expect }) => {
    const h = await harness();
    await h.deps.outbox.enqueue([
      { kind: "SUBMISSION_CONFIRMATION", requestId: REQUEST_ID, origin: null },
    ]);
    h.failEvery.value = true;

    const result = await drainOutbox(h.deps, NOW, MAX_DRAIN);

    expect(result).toEqual({ sent: 0, retried: 1, deadLettered: 0 });
    expect(h.sent).toHaveLength(0);
  });

  it("dead-letters a row after the last allowed attempt", async ({ expect }) => {
    const h = await harness();
    await h.deps.outbox.enqueue([
      { kind: "SUBMISSION_CONFIRMATION", requestId: REQUEST_ID, origin: null },
    ]);
    h.failEvery.value = true;
    for (const minutes of [3, 8, 17, 34]) {
      const retried = await drainOutbox(
        h.deps,
        new Date(NOW.getTime() + minutes * 60_000),
        MAX_DRAIN,
      );
      expect(retried).toEqual({ sent: 0, retried: 1, deadLettered: 0 });
    }

    const result = await drainOutbox(h.deps, new Date(NOW.getTime() + 60 * 60_000), MAX_DRAIN);

    expect(result).toEqual({ sent: 0, retried: 0, deadLettered: 1 });
    expect(h.sent).toHaveLength(0);
  });

  it("retries an unexpected sender error", async ({ expect }) => {
    const h = await harness({
      sender: {
        send: async () => Promise.reject(new TypeError("unexpected")),
      },
    });
    await h.deps.outbox.enqueue([
      { kind: "SUBMISSION_CONFIRMATION", requestId: REQUEST_ID, origin: null },
    ]);

    const result = await drainOutbox(h.deps, NOW, MAX_DRAIN);

    expect(result).toEqual({ sent: 0, retried: 1, deadLettered: 0 });
  });

  it("retries when the recipient is no longer available", async ({ expect }) => {
    const h = await harness();
    await h.deps.requests.erasePii(REQUEST_ID, "2026-10-22T08:30:00.000Z");
    await h.deps.outbox.enqueue([{ kind: "READY_NOTICE", requestId: REQUEST_ID, origin: null }]);

    const result = await drainOutbox(h.deps, NOW, MAX_DRAIN);

    expect(result).toEqual({ sent: 0, retried: 1, deadLettered: 0 });
    expect(h.sent).toHaveLength(0);
  });

  it("retries when encrypted personal data cannot be decrypted", async ({ expect }) => {
    const h = await harness();
    await h.store.db
      .prepare("UPDATE requests SET pii_ciphertext = ? WHERE id = ?")
      .bind(new Uint8Array([1, 2, 3]), REQUEST_ID)
      .run();
    await h.deps.outbox.enqueue([{ kind: "READY_NOTICE", requestId: REQUEST_ID, origin: null }]);

    expect(await drainOutbox(h.deps, NOW, MAX_DRAIN)).toEqual({
      sent: 0,
      retried: 1,
      deadLettered: 0,
    });
  });

  it("retries a row whose request row has vanished", async ({ expect }) => {
    const h = await harness();
    await h.store.db.prepare("PRAGMA foreign_keys = OFF").run();
    await h.store.db.prepare("DELETE FROM requests WHERE id = ?").bind(REQUEST_ID).run();
    await h.deps.outbox.enqueue([
      { kind: "SUBMISSION_CONFIRMATION", requestId: REQUEST_ID, origin: null },
    ]);

    const result = await drainOutbox(h.deps, NOW, MAX_DRAIN);

    expect(result).toEqual({ sent: 0, retried: 1, deadLettered: 0 });
    expect(h.sent).toHaveLength(0);
  });

  it("drains nothing without due rows", async ({ expect }) => {
    const h = await harness();

    expect(await drainOutbox(h.deps, NOW, MAX_DRAIN)).toEqual({
      sent: 0,
      retried: 0,
      deadLettered: 0,
    });
  });
});
