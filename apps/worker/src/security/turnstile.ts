import { z } from "zod";

import { logEvent } from "../logging/log.ts";

export type FetchLike = typeof fetch;

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_ACTION = "request";
export const TURNSTILE_MAX_AGE_MS = 300_000;

const verificationSchema = z.strictObject({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  challenge_ts: z.string().optional(),
});

export interface TurnstileInput {
  readonly response: string;
  readonly hostname: string;
  readonly remoteIp?: string;
}

export interface TurnstileVerifier {
  verify(input: TurnstileInput, now: Date): Promise<boolean>;
}

export function turnstileVerifier(
  secretKey: string,
  doFetch: FetchLike = fetch,
): TurnstileVerifier {
  return {
    verify: async (input, now) => verifyChallenge({ secretKey, doFetch }, input, now),
  };
}

async function verifyChallenge(
  config: { readonly secretKey: string; readonly doFetch: FetchLike },
  input: TurnstileInput,
  now: Date,
): Promise<boolean> {
  try {
    const body = new URLSearchParams({ secret: config.secretKey, response: input.response });
    if (input.remoteIp !== undefined) {
      body.set("remoteip", input.remoteIp);
    }
    const response = await config.doFetch(TURNSTILE_VERIFY_URL, { method: "POST", body });
    if (!response.ok) {
      return false;
    }
    const payload: unknown = await response.json();
    const parsed = verificationSchema.safeParse(payload);
    if (!parsed.success) {
      return false;
    }
    return (
      parsed.data.success &&
      parsed.data.action === TURNSTILE_ACTION &&
      parsed.data.hostname === input.hostname &&
      isFresh(parsed.data.challenge_ts, now)
    );
  } catch (error) {
    logEvent({
      event: "turnstile_unavailable",
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}

function isFresh(challengeTs: string | undefined, now: Date): boolean {
  if (challengeTs === undefined) {
    return false;
  }
  const ageMs = now.getTime() - Date.parse(challengeTs);
  return ageMs >= 0 && ageMs <= TURNSTILE_MAX_AGE_MS;
}
