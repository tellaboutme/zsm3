import { z } from "zod";

import { ACTIVE_PII_KEY_ID, MissingSecretError, piiKeys, type RequestsSecretEnv } from "../env.ts";

export interface QuestionsEnv extends RequestsSecretEnv {
  readonly SKRZYNKA_ENABLED?: string | undefined;
}

export interface QuestionsConfig {
  readonly piiKeys: Readonly<Record<string, string>>;
  readonly activePiiKeyId: string;
  readonly rateLimitSalt: string;
  readonly turnstileSecretKey: string;
}

const configSchema = z.strictObject({
  piiKeys: z.record(z.string().min(1), z.string().min(32)),
  rateLimitSalt: z.string().min(32),
  turnstileSecretKey: z.string().min(1),
});

export function questionsEnabled(env: QuestionsEnv): boolean {
  return env.SKRZYNKA_ENABLED?.trim() === "true";
}

export function questionsConfig(env: QuestionsEnv): QuestionsConfig {
  const parsed = configSchema.safeParse({
    piiKeys: piiKeys(env),
    rateLimitSalt: env.RATE_LIMIT_SALT,
    turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
  });
  if (!parsed.success) {
    throw new MissingSecretError(
      parsed.error.issues.map((issue) => issue.path.join(".")).join(", "),
    );
  }
  if (!(ACTIVE_PII_KEY_ID in parsed.data.piiKeys)) {
    throw new MissingSecretError(`PII_KEY_${ACTIVE_PII_KEY_ID}`);
  }
  return { activePiiKeyId: ACTIVE_PII_KEY_ID, ...parsed.data };
}
