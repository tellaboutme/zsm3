import { z } from "zod";

import type { SqlDatabase } from "./storage/database.ts";

export interface RequestsSecretEnv {
  readonly DB?: SqlDatabase;
  readonly PII_KEY_PRIMARY?: string | undefined;
  readonly PII_KEY_SECONDARY?: string | undefined;
  readonly EMAIL_INDEX_KEY?: string | undefined;
  readonly RATE_LIMIT_SALT?: string | undefined;
  readonly TURNSTILE_SECRET_KEY?: string | undefined;
  readonly TURNSTILE_SITE_KEY?: string | undefined;
  readonly BREVO_API_KEY?: string | undefined;
  readonly STATUS_EMAIL_FROM?: string | undefined;
  readonly SECRETARIAT_EMAIL?: string | undefined;
}

export const ACTIVE_PII_KEY_ID = "PRIMARY";

export class MissingSecretError extends Error {
  readonly secretName: string;

  constructor(secretName: string) {
    super(`Missing or invalid configuration value: ${secretName}`);
    this.name = "MissingSecretError";
    this.secretName = secretName;
  }
}

export interface RequestsConfig {
  readonly piiKeys: Readonly<Record<string, string>>;
  readonly activePiiKeyId: string;
  readonly emailIndexKey: string;
  readonly rateLimitSalt: string;
  readonly turnstileSecretKey: string;
  readonly turnstileSiteKey: string;
  readonly brevoApiKey: string;
  readonly statusEmailFrom: string;
  readonly secretariatEmail: string;
}

const configSchema = z.strictObject({
  piiKeys: z.record(z.string().min(1), z.string().min(32)),
  emailIndexKey: z.string().min(32),
  rateLimitSalt: z.string().min(32),
  turnstileSecretKey: z.string().min(1),
  turnstileSiteKey: z.string().min(1),
  brevoApiKey: z.string().min(1),
  statusEmailFrom: z.email(),
  secretariatEmail: z.email(),
});

export function requestsConfig(env: RequestsSecretEnv): RequestsConfig {
  const piiKeySources: readonly (readonly [string, string | undefined])[] = [
    ["PRIMARY", env.PII_KEY_PRIMARY],
    ["SECONDARY", env.PII_KEY_SECONDARY],
  ];
  const parsed = configSchema.safeParse({
    piiKeys: Object.fromEntries(
      piiKeySources.filter((entry): entry is readonly [string, string] => entry[1] !== undefined),
    ),
    emailIndexKey: env.EMAIL_INDEX_KEY,
    rateLimitSalt: env.RATE_LIMIT_SALT,
    turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
    turnstileSiteKey: env.TURNSTILE_SITE_KEY,
    brevoApiKey: env.BREVO_API_KEY,
    statusEmailFrom: env.STATUS_EMAIL_FROM,
    secretariatEmail: env.SECRETARIAT_EMAIL,
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
