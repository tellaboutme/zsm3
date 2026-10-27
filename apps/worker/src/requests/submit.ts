import { requestInputSchema, type RequestInput, type RequestPii } from "@zsm3/contracts/requests";
import { z } from "zod";

import type { RequestsConfig } from "../env.ts";
import type { PiiCrypto } from "../security/pii-crypto.ts";
import { emailIndex as piiEmailIndex } from "../security/pii-crypto.ts";
import { statusToken, tokenHash } from "../security/tokens.ts";
import type { TurnstileVerifier } from "../security/turnstile.ts";
import type { RandomBytes } from "../storage/ids.ts";
import { uuidv7 } from "../storage/ids.ts";
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MINUTES,
  type RateLimitsRepo,
  type RateLimitState,
  rateLimitKey,
} from "../storage/rate-limits-repo.ts";
import type { RequestsRepo } from "../storage/requests-repo.ts";

export const MIN_FORM_FILL_MS = 3000;
export const STATUS_PATH = "/e-wniosek/status";

export type SubmitRefusalReason = "rate_limit" | "turnstile" | "trap" | "invalid" | "open_limit";

export type SubmitOutcome =
  | { readonly kind: "created" | "duplicate"; readonly statusUrl: string }
  | { readonly kind: "refused"; readonly reason: SubmitRefusalReason };

export interface SubmitDeps {
  readonly requests: RequestsRepo;
  readonly rateLimits: RateLimitsRepo;
  readonly crypto: PiiCrypto;
  readonly turnstile: TurnstileVerifier;
  readonly config: RequestsConfig;
  readonly random: RandomBytes;
}

export interface SubmitInput {
  readonly origin: string;
  readonly clientIp: string;
  readonly body: unknown;
  readonly now: Date;
}

const turnstileTokenSchema = z.object({ turnstileToken: z.string().min(1) });

export function statusLink(origin: string, token: string | undefined): string {
  return token === undefined ? `${origin}${STATUS_PATH}` : `${origin}${STATUS_PATH}#${token}`;
}

export async function submitRequest(deps: SubmitDeps, input: SubmitInput): Promise<SubmitOutcome> {
  const early = await refuseEarly(deps, input);
  if (early !== undefined) {
    return { kind: "refused", reason: early };
  }
  const parsed = requestInputSchema.safeParse(input.body);
  if (!parsed.success) {
    return { kind: "refused", reason: "invalid" };
  }
  if (input.now.getTime() - parsed.data.submittedAtMs < MIN_FORM_FILL_MS) {
    return { kind: "refused", reason: "trap" };
  }
  return storeRequest(deps, input, parsed.data);
}

async function refuseEarly(
  deps: SubmitDeps,
  input: SubmitInput,
): Promise<SubmitRefusalReason | undefined> {
  const window = await consumeIpBucket(deps, input);
  if (window.count > RATE_LIMIT_MAX) {
    return "rate_limit";
  }
  const token = turnstileTokenSchema.safeParse(input.body);
  if (!token.success) {
    return "invalid";
  }
  const verified = await deps.turnstile.verify(
    {
      response: token.data.turnstileToken,
      hostname: new URL(input.origin).hostname,
      remoteIp: input.clientIp,
    },
    input.now,
  );
  return verified ? undefined : "turnstile";
}

async function storeRequest(
  deps: SubmitDeps,
  input: SubmitInput,
  parsed: RequestInput,
): Promise<SubmitOutcome> {
  const token = statusToken(deps.random);
  const id = uuidv7(input.now.getTime(), deps.random);
  const encrypted = await deps.crypto.encrypt(JSON.stringify(piiOf(parsed, token)), id);
  const emailIndex = await piiEmailIndex(deps.config.emailIndexKey, parsed.email);
  const outcome = await deps.requests.createWithConfirmations(
    {
      id,
      type: parsed.type,
      piiCiphertext: encrypted.ciphertext,
      piiKeyId: encrypted.keyId,
      emailIndex,
      statusTokenHash: await tokenHash(token),
      formKey: parsed.formKey,
    },
    input.origin,
  );
  if (outcome.kind === "open_limit") {
    return { kind: "refused", reason: "open_limit" };
  }
  if (outcome.kind === "duplicate") {
    if (!sameEmailIndex(emailIndex, outcome.record.emailIndex)) {
      return { kind: "refused", reason: "invalid" };
    }
    return { kind: "duplicate", statusUrl: statusLink(input.origin, undefined) };
  }
  return { kind: "created", statusUrl: statusLink(input.origin, token) };
}

function sameEmailIndex(expected: Uint8Array, actual: Uint8Array | null): boolean {
  if (actual?.length !== expected.length) {
    return false;
  }
  let difference = 0;
  const actualView = new DataView(actual.buffer, actual.byteOffset, actual.byteLength);
  for (const [index, byte] of expected.entries()) {
    difference |= byte ^ actualView.getUint8(index);
  }
  return difference === 0;
}

async function consumeIpBucket(deps: SubmitDeps, input: SubmitInput): Promise<RateLimitState> {
  const key = await rateLimitKey(deps.config.rateLimitSalt, input.clientIp);
  const cutoff = new Date(input.now.getTime() - RATE_LIMIT_WINDOW_MINUTES * 60_000);
  return deps.rateLimits.consume(key, input.now.toISOString(), cutoff.toISOString());
}

function piiOf(parsed: RequestInput, token: string): RequestPii {
  const graduationYear =
    parsed.type === "ENROLLMENT_CERTIFICATE" ? parsed.graduationYear : undefined;
  return {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    email: parsed.email,
    ...(parsed.className !== undefined ? { className: parsed.className } : {}),
    ...(graduationYear !== undefined ? { graduationYear } : {}),
    ...(parsed.note !== undefined ? { note: parsed.note } : {}),
    statusToken: token,
  };
}
