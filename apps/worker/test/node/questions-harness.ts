import {
  counterRandom,
  FIXED_CLOCK,
  memoryDatabase,
  type MemoryDatabase,
} from "./memory-database.ts";
import { SECRETS } from "./request-harness.ts";
import { questionsConfig } from "../../src/questions/config.ts";
import type { QuestionSubmitDeps, QuestionSubmitInput } from "../../src/questions/submit.ts";
import { piiCrypto, type PiiCrypto } from "../../src/security/pii-crypto.ts";
import { QUESTION_TURNSTILE_ACTION, turnstileVerifier } from "../../src/security/turnstile.ts";
import type { Store } from "../../src/storage/database.ts";
import { questionsRepo, type QuestionsRepo } from "../../src/storage/questions-repo.ts";
import { rateLimitsRepo } from "../../src/storage/rate-limits-repo.ts";

export const NOW = new Date("2026-10-22T08:00:00Z");
export const ORIGIN = "https://zsm3.test";
export const QUESTION = "Jak poradzić sobie ze stresem przed maturą próbną?";

export interface TurnstileReply {
  readonly success?: boolean;
  readonly action?: string;
  readonly hostname?: string;
}

export interface QuestionHarness {
  readonly db: MemoryDatabase;
  readonly store: Store;
  readonly deps: QuestionSubmitDeps;
  readonly repo: QuestionsRepo;
  readonly crypto: PiiCrypto;
  readonly verifications: URLSearchParams[];
}

export function questionBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    addressee: "psychologist",
    question: QUESTION,
    rulesAccepted: true,
    honeypot: "",
    formKey: crypto.randomUUID(),
    turnstileToken: "tok",
    ...overrides,
  };
}

export function questionInput(body: unknown, clientIp = "203.0.113.7"): QuestionSubmitInput {
  return { origin: ORIGIN, clientIp, body, now: NOW };
}

export function questionHarness(reply: TurnstileReply = {}): QuestionHarness {
  const db = memoryDatabase();
  const store: Store = { db, clock: FIXED_CLOCK, random: counterRandom() };
  const config = questionsConfig(SECRETS);
  const verifications: URLSearchParams[] = [];
  const turnstile = turnstileVerifier(
    config.turnstileSecretKey,
    async (...args: Parameters<typeof fetch>) => {
      const sent = args[1]?.body;
      verifications.push(sent instanceof URLSearchParams ? sent : new URLSearchParams());
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: reply.success ?? true,
            action: reply.action ?? QUESTION_TURNSTILE_ACTION,
            hostname: reply.hostname ?? "zsm3.test",
            challenge_ts: "2026-10-22T07:59:30.000Z",
          }),
        ),
      );
    },
    QUESTION_TURNSTILE_ACTION,
  );
  const crypto = piiCrypto(config.piiKeys, config.activePiiKeyId, store.random);
  const repo = questionsRepo(store);
  const deps: QuestionSubmitDeps = {
    questions: repo,
    rateLimits: rateLimitsRepo(store),
    crypto,
    turnstile,
    config,
    random: store.random,
  };
  return { db, store, deps, repo, crypto, verifications };
}

export function storedRows(db: MemoryDatabase): readonly Record<string, unknown>[] {
  return db.sqlite.prepare("SELECT * FROM questions ORDER BY id").all();
}

const SCANNED_TABLES = [
  "SELECT * FROM questions",
  "SELECT * FROM audit_log",
  "SELECT * FROM rate_limits",
  "SELECT * FROM requests",
  "SELECT * FROM email_outbox",
] as const;

export function everyStoredText(db: MemoryDatabase): string {
  return SCANNED_TABLES.flatMap((query) => db.sqlite.prepare(query).all())
    .flatMap((row) => Object.values(row))
    .map((value) => (value instanceof Uint8Array ? new TextDecoder().decode(value) : String(value)))
    .join(" | ");
}
