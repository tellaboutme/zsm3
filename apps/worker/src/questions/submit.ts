import { questionInputSchema } from "@zsm3/contracts/questions";
import { z } from "zod";

import type { QuestionsConfig } from "./config.ts";
import { seal } from "./sealing.ts";
import { warsawDay } from "../domain/question-lifecycle.ts";
import type { PiiCrypto } from "../security/pii-crypto.ts";
import type { TurnstileVerifier } from "../security/turnstile.ts";
import { uuidv4, type RandomBytes } from "../storage/ids.ts";
import type { QuestionsRepo } from "../storage/questions-repo.ts";
import {
  RATE_LIMIT_WINDOW_MINUTES,
  rateLimitKey,
  type RateLimitsRepo,
} from "../storage/rate-limits-repo.ts";

export const QUESTION_ATTEMPT_LIMIT = 30;
export const QUESTION_ACCEPTED_LIMIT = 10;
export const QUESTION_WINDOW_MS = RATE_LIMIT_WINDOW_MINUTES * 60_000;

export type QuestionRefusal = "rate_limit" | "turnstile" | "invalid";

export type QuestionOutcome =
  { readonly kind: "received" } | { readonly kind: "refused"; readonly reason: QuestionRefusal };

export interface QuestionSubmitDeps {
  readonly questions: QuestionsRepo;
  readonly rateLimits: RateLimitsRepo;
  readonly crypto: PiiCrypto;
  readonly turnstile: TurnstileVerifier;
  readonly config: QuestionsConfig;
  readonly random: RandomBytes;
}

export interface QuestionSubmitInput {
  readonly origin: string;
  readonly clientIp: string;
  readonly body: unknown;
  readonly now: Date;
}

const tokenSchema = z.object({ turnstileToken: z.string().min(1).max(2048) });

export function windowStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / QUESTION_WINDOW_MS) * QUESTION_WINDOW_MS);
}

async function overLimit(
  deps: QuestionSubmitDeps,
  input: QuestionSubmitInput,
  purpose: "question-attempt" | "question",
  limit: number,
): Promise<boolean> {
  const key = await rateLimitKey(deps.config.rateLimitSalt, input.clientIp, purpose);
  const slot = windowStart(input.now).toISOString();
  const state = await deps.rateLimits.consume(key, slot, slot);
  return state.count > limit;
}

async function refuseEarly(
  deps: QuestionSubmitDeps,
  input: QuestionSubmitInput,
): Promise<QuestionRefusal | undefined> {
  if (await overLimit(deps, input, "question-attempt", QUESTION_ATTEMPT_LIMIT)) {
    return "rate_limit";
  }
  const token = tokenSchema.safeParse(input.body);
  if (!token.success) {
    return "invalid";
  }
  const verified = await deps.turnstile.verify(
    { response: token.data.turnstileToken, hostname: new URL(input.origin).hostname },
    input.now,
  );
  return verified ? undefined : "turnstile";
}

export async function submitQuestion(
  deps: QuestionSubmitDeps,
  input: QuestionSubmitInput,
): Promise<QuestionOutcome> {
  const early = await refuseEarly(deps, input);
  if (early !== undefined) {
    return { kind: "refused", reason: early };
  }
  const parsed = questionInputSchema.safeParse(input.body);
  if (!parsed.success) {
    return { kind: "refused", reason: "invalid" };
  }
  if (await overLimit(deps, input, "question", QUESTION_ACCEPTED_LIMIT)) {
    return { kind: "refused", reason: "rate_limit" };
  }
  const id = uuidv4(deps.random);
  await deps.questions.receive({
    id,
    addressee: parsed.data.addressee,
    question: await seal(deps.crypto, "question", id, parsed.data.question),
    formKey: parsed.data.formKey,
    receivedOn: warsawDay(input.now),
  });
  return { kind: "received" };
}
