import { describe, it } from "vitest";

import { MissingSecretError, requestsConfig, type RequestsSecretEnv } from "../../src/env.ts";

const VALID: RequestsSecretEnv = {
  PII_KEY_PRIMARY: "primary-key-0123456789-0123456789-0123456789",
  PII_KEY_SECONDARY: `test-${"s".repeat(32)}`,
  EMAIL_INDEX_KEY: "email-index-key-0123456789-0123456789",
  RATE_LIMIT_SALT: "rate-limit-salt-0123456789-01234567890",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  TURNSTILE_SITE_KEY: "turnstile-site",
  BREVO_API_KEY: "brevo-key",
  STATUS_EMAIL_FROM: "no-reply@zespolszkolmechanicznych.edu.pl",
  SECRETARIAT_EMAIL: "u@zespolszkolmechanicznych.edu.pl",
};

function without(key: keyof RequestsSecretEnv): RequestsSecretEnv {
  const copy: RequestsSecretEnv = { ...VALID };
  return Object.fromEntries(Object.entries(copy).filter(([name]) => name !== key));
}

const REQUIRED_KEYS: readonly (keyof RequestsSecretEnv)[] = [
  "PII_KEY_PRIMARY",
  "EMAIL_INDEX_KEY",
  "RATE_LIMIT_SALT",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_SITE_KEY",
  "BREVO_API_KEY",
  "STATUS_EMAIL_FROM",
  "SECRETARIAT_EMAIL",
];

describe("requestsConfig", () => {
  it("collects the request secrets and marks the active key", ({ expect }) => {
    const config = requestsConfig(VALID);
    expect(config.activePiiKeyId).toBe("PRIMARY");
    expect(config.piiKeys).toMatchObject({
      PRIMARY: VALID.PII_KEY_PRIMARY,
      SECONDARY: VALID.PII_KEY_SECONDARY,
    });
    expect(config.emailIndexKey).toBe(VALID.EMAIL_INDEX_KEY);
    expect(config.rateLimitSalt).toBe(VALID.RATE_LIMIT_SALT);
    expect(config.secretariatEmail).toBe(VALID.SECRETARIAT_EMAIL);
  });

  it("keeps working without the secondary key", ({ expect }) => {
    const config = requestsConfig(without("PII_KEY_SECONDARY"));
    expect(Object.keys(config.piiKeys)).toEqual(["PRIMARY"]);
  });

  it("rejects missing, short or invalid values", ({ expect }) => {
    for (const key of REQUIRED_KEYS) {
      expect(() => requestsConfig(without(key)), key).toThrow(MissingSecretError);
    }
    expect(() => requestsConfig({ ...VALID, EMAIL_INDEX_KEY: "short" })).toThrow(
      MissingSecretError,
    );
    expect(() => requestsConfig({ ...VALID, STATUS_EMAIL_FROM: "not-an-email" })).toThrow(
      MissingSecretError,
    );
  });

  it("requires the active primary key", ({ expect }) => {
    const secondaryOnly = {
      ...without("PII_KEY_PRIMARY"),
      PII_KEY_SECONDARY: "only-secondary-key-0123456789-0123456789",
    };
    expect(() => requestsConfig(secondaryOnly)).toThrow("PII_KEY_PRIMARY");
  });
});
