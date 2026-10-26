import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterAll, beforeAll, vi } from "vitest";

import { createRequestsApp, MAX_REQUEST_BODY_BYTES } from "../src/requests-app.ts";
import { TURNSTILE_VERIFY_URL } from "../src/security/turnstile.ts";

export { createRequestsApp, MAX_REQUEST_BODY_BYTES };

export const ORIGIN = "https://zsm3.test";
const CHALLENGE_TS = new Date(Date.now() - 1_000).toISOString();

export function formKey(): string {
  return crypto.randomUUID();
}

export function body(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "STUDENT_ID_RENEWAL",
    firstName: "Jan",
    lastName: "Przykładowy",
    email: "jan@example.com",
    className: "4tp",
    turnstileToken: "tok",
    noticesAccepted: true,
    honeypot: "",
    formKey: formKey(),
    submittedAtMs: Date.now() - 5000,
    ...overrides,
  });
}

export async function request(
  path: string,
  init: RequestInit = {},
  environment: Env = env,
): Promise<Response> {
  return createRequestsApp().request(`${ORIGIN}${path}`, init, environment);
}

export async function jsonPost(path: string, payload: string, ip: string): Promise<Response> {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: payload,
  });
}

export function outboundUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  return input instanceof URL ? input.href : input.url;
}

export function setupRequestsTest(): void {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    vi.stubGlobal("fetch", async (input: RequestInfo | URL): Promise<Response> =>
      outboundUrl(input) === TURNSTILE_VERIFY_URL
        ? Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                action: "request",
                hostname: "zsm3.test",
                challenge_ts: CHALLENGE_TS,
              }),
              { status: 200 },
            ),
          )
        : Promise.reject(new Error(`Unexpected outbound fetch: ${outboundUrl(input)}`)),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });
}
