import { describe, it, vi } from "vitest";
import { z } from "zod";

import { logEvent } from "../../src/logging/log.ts";
import {
  TURNSTILE_ACTION,
  TURNSTILE_VERIFY_URL,
  turnstileVerifier,
  type TurnstileInput,
} from "../../src/security/turnstile.ts";

const CHALLENGE_TS = "2026-10-22T07:59:30.000Z";
const NOW = new Date("2026-10-22T08:00:00Z");

function input(overrides: Partial<TurnstileInput>): TurnstileInput {
  return { response: "tok", hostname: "zsm3.test", ...overrides };
}

function okBody(overrides: Record<string, unknown>): string {
  return JSON.stringify({
    success: true,
    action: TURNSTILE_ACTION,
    hostname: "zsm3.test",
    challenge_ts: CHALLENGE_TS,
    ...overrides,
  });
}

function doFetchReply(status: number, body: string) {
  return vi.fn(async (...args: Parameters<typeof fetch>) => {
    if (args.length !== 2) throw new Error("Missing fetch options");
    return Promise.resolve(new Response(body, { status }));
  });
}

describe("turnstileVerifier", () => {
  it("posts the secret, response and optional remote ip", async ({ expect }) => {
    const doFetch = doFetchReply(200, okBody({}));
    const verifier = turnstileVerifier("secret", doFetch);

    await expect(verifier.verify(input({ remoteIp: "1.2.3.4" }), NOW)).resolves.toBe(true);
    expect(doFetch).toHaveBeenCalledExactlyOnceWith(
      TURNSTILE_VERIFY_URL,
      expect.objectContaining({ method: "POST" }),
    );
    const body = z.instanceof(URLSearchParams).parse(doFetch.mock.calls[0]?.[1]?.body).toString();
    expect(body).toContain("secret=secret");
    expect(body).toContain("response=tok");
    expect(body).toContain("remoteip=1.2.3.4");
  });

  it("omits the remote ip when absent", async ({ expect }) => {
    const doFetch = doFetchReply(200, okBody({}));
    const verifier = turnstileVerifier("secret", doFetch);

    await expect(verifier.verify(input({}), NOW)).resolves.toBe(true);
    expect(
      z.instanceof(URLSearchParams).parse(doFetch.mock.calls[0]?.[1]?.body).has("remoteip"),
    ).toBe(false);
  });

  it("rejects a challenge that is too old, in the future or missing", async ({ expect }) => {
    const stale = turnstileVerifier(
      "secret",
      doFetchReply(200, okBody({ challenge_ts: "2026-10-22T07:54:59.000Z" })),
    );
    const future = turnstileVerifier(
      "secret",
      doFetchReply(200, okBody({ challenge_ts: "2026-10-22T08:00:01.000Z" })),
    );
    const missing = turnstileVerifier(
      "secret",
      doFetchReply(200, okBody({ challenge_ts: undefined })),
    );

    await expect(stale.verify(input({}), NOW)).resolves.toBe(false);
    await expect(future.verify(input({}), NOW)).resolves.toBe(false);
    await expect(missing.verify(input({}), NOW)).resolves.toBe(false);
  });

  it("accepts a challenge exactly at either end of the five-minute window", async ({ expect }) => {
    const justIssued = turnstileVerifier(
      "secret",
      doFetchReply(200, okBody({ challenge_ts: NOW.toISOString() })),
    );
    const oldest = turnstileVerifier(
      "secret",
      doFetchReply(200, okBody({ challenge_ts: "2026-10-22T07:55:00.000Z" })),
    );
    await expect(justIssued.verify(input({}), NOW)).resolves.toBe(true);
    await expect(oldest.verify(input({}), NOW)).resolves.toBe(true);
  });

  it("rejects a mismatched action or hostname", async ({ expect }) => {
    const wrongAction = turnstileVerifier("secret", doFetchReply(200, okBody({ action: "other" })));
    const wrongHost = turnstileVerifier(
      "secret",
      doFetchReply(200, okBody({ hostname: "evil.test" })),
    );
    const unsuccessful = turnstileVerifier("secret", doFetchReply(200, okBody({ success: false })));

    await expect(wrongAction.verify(input({}), NOW)).resolves.toBe(false);
    await expect(wrongHost.verify(input({}), NOW)).resolves.toBe(false);
    await expect(unsuccessful.verify(input({}), NOW)).resolves.toBe(false);
  });

  it("rejects broken payloads and http errors", async ({ expect }) => {
    const malformed = turnstileVerifier("secret", doFetchReply(200, "not-json"));
    const unexpected = turnstileVerifier(
      "secret",
      doFetchReply(200, JSON.stringify({ success: true, extra: 1 })),
    );
    const httpError = turnstileVerifier("secret", doFetchReply(503, "busy"));

    await expect(malformed.verify(input({}), NOW)).resolves.toBe(false);
    await expect(unexpected.verify(input({}), NOW)).resolves.toBe(false);
    await expect(httpError.verify(input({}), NOW)).resolves.toBe(false);
  });

  it("treats a network failure as a rejection and logs it", async ({ expect }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const doFetch = vi.fn(async () => Promise.reject(new TypeError("network down")));
    const verifier = turnstileVerifier("secret", doFetch);

    await expect(verifier.verify(input({}), NOW)).resolves.toBe(false);
    expect(logged).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ event: "turnstile_unavailable", errorName: "TypeError" }),
    );
    logged.mockRestore();
  });

  it("logs an unknown failure when fetch throws a non-error", async ({ expect }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const verifier = turnstileVerifier(
      "secret",
      vi.fn<typeof fetch>().mockRejectedValue("unavailable"),
    );

    await expect(verifier.verify(input({}), NOW)).resolves.toBe(false);
    expect(logged).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ event: "turnstile_unavailable", errorName: "unknown" }),
    );
    logged.mockRestore();
  });
});

describe("logEvent", () => {
  it("serialises events as json on stderr", ({ expect }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logEvent({ event: "unhandled_error", requestId: "request-1", errorName: "TypeError" });
    expect(logged).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ event: "unhandled_error", requestId: "request-1", errorName: "TypeError" }),
    );
    logged.mockRestore();
  });
});
