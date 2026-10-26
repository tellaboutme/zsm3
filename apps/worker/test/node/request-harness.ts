import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { requestsConfig, type RequestsSecretEnv } from "../../src/env.ts";
import type { SubmitDeps, SubmitInput } from "../../src/requests/submit.ts";
import { piiCrypto } from "../../src/security/pii-crypto.ts";
import { turnstileVerifier, type TurnstileVerifier } from "../../src/security/turnstile.ts";
import type { Store } from "../../src/storage/database.ts";
import { outboxRepo } from "../../src/storage/outbox-repo.ts";
import { rateLimitsRepo } from "../../src/storage/rate-limits-repo.ts";
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
export const ORIGIN = "https://zsm3.test";
const CHALLENGE_TS = "2026-10-22T07:59:30.000Z";

export function submitBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "STUDENT_ID_RENEWAL",
    firstName: "Jan",
    lastName: "Przykładowy",
    email: "jan@example.com",
    className: "4tp",
    turnstileToken: "tok",
    noticesAccepted: true,
    honeypot: "",
    formKey: crypto.randomUUID(),
    submittedAtMs: NOW.getTime() - 5000,
    ...overrides,
  };
}

export interface SubmitHarness {
  readonly store: Store;
  readonly deps: SubmitDeps;
  readonly requests: ReturnType<typeof requestsRepo>;
  readonly outbox: ReturnType<typeof outboxRepo>;
  readonly config: ReturnType<typeof requestsConfig>;
}

export function submitHarness(): SubmitHarness {
  const store: Store = { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
  const config = requestsConfig(SECRETS);
  const turnstile: TurnstileVerifier = turnstileVerifier(config.turnstileSecretKey, async () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          success: true,
          action: "request",
          hostname: "zsm3.test",
          challenge_ts: CHALLENGE_TS,
        }),
        { status: 200 },
      ),
    ),
  );
  const deps: SubmitDeps = {
    requests: requestsRepo(store),
    rateLimits: rateLimitsRepo(store),
    crypto: piiCrypto(config.piiKeys, config.activePiiKeyId, store.random),
    turnstile,
    config,
    random: store.random,
  };
  return { store, deps, requests: deps.requests, outbox: outboxRepo(store), config };
}

export function submitInput(body: unknown, origin = ORIGIN, clientIp = "1.2.3.4"): SubmitInput {
  return { origin, clientIp, body, now: NOW };
}
