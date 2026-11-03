import { questionInputSchema } from "@zsm3/contracts/questions";
import { z } from "zod";

import type { QuestionsConfig } from "./config.ts";
import { seal } from "./sealing.ts";
import type { PiiCrypto } from "../security/pii-crypto.ts";
import type { TurnstileVerifier } from "../security/turnstile.ts";
import { uuidv4, type RandomBytes } from "../storage/ids.ts";
import type { QuestionsRepo } from "../storage/questions-repo.ts";
import {
  RATE_LIMIT_WINDOW_MINUTES,
  rateLimitKey,
  type RateLimitsRepo,
} from "../storage/rate-limits-repo.ts";

export const QUESTION_RATE_LIMIT_MAX = 3;
export const MIN_QUESTION_FILL_MS = 5000;

export type QuestionRefusal = "rate_limit" | "turnstile" | "trap" | "invalid";

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

async function overLimit(deps: QuestionSubmitDeps, input: QuestionSubmitInput): Promise<boolean> {
  const key = await rateLimitKey(deps.config.rateLimitSalt, input.clientIp, "question");
  const cutoff = new Date(input.now.getTime() - RATE_LIMIT_WINDOW_MINUTES * 60_000);
  const state = await deps.rateLimits.consume(key, input.now.toISOString(), cutoff.toISOString());
  return state.count > QUESTION_RATE_LIMIT_MAX;
}

async function refuseEarly(
  deps: QuestionSubmitDeps,
  input: QuestionSubmitInput,
): Promise<QuestionRefusal | undefined> {
  if (await overLimit(deps, input)) {
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
  if (input.now.getTime() - parsed.data.submittedAtMs < MIN_QUESTION_FILL_MS) {
    return { kind: "refused", reason: "trap" };
  }
  const id = uuidv4(deps.random);
  await deps.questions.receive({
    id,
    addressee: parsed.data.addressee,
    question: await seal(deps.crypto, "question", id, parsed.data.question),
    formKey: parsed.data.formKey,
    receivedOn: input.now.toISOString().slice(0, 10),
  });
  return { kind: "received" };
}
