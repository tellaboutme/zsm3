import { problemDetailsSchema, PROBLEM_CONTENT_TYPE } from "@zsm3/contracts/problem";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { memoryDatabase } from "./memory-database.ts";
import { ORIGIN, SECRETS, submitBody } from "./request-harness.ts";
import { createRequestsApp } from "../../src/requests-app.ts";

const app = createRequestsApp();
const refusedOrigins: (string | null)[] = [
  null,
  "null",
  "https://attacker.test",
  "http://zsm3.test",
];

interface PostOptions {
  readonly body?: string;
  readonly origin?: string | null;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (): Promise<Response> =>
        await Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              action: "request",
              hostname: "zsm3.test",
              challenge_ts: new Date(Date.now() - 1000).toISOString(),
            }),
          ),
        ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function harness() {
  const env = {
    ...SECRETS,
    DB: memoryDatabase(),
    MEDIA: { get: async () => await Promise.resolve(null) },
  };
  const post = async (
    path: string,
    ip: string,
    {
      body = JSON.stringify(submitBody({ submittedAtMs: Date.now() - 5000 })),
      origin = ORIGIN,
    }: PostOptions = {},
  ): Promise<Response> =>
    await app.request(
      `${ORIGIN}/api/requests${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": ip,
          ...(origin === null ? {} : { Origin: origin }),
        },
        body,
      },
      env,
    );
  return post;
}

describe("state-changing request routes require a same-origin header", () => {
  it("answers 403 when submit or withdraw posts miss a same-origin header", async ({ expect }) => {
    const post = harness();
    let step = 0;
    for (const path of ["", "/withdraw"]) {
      for (const origin of refusedOrigins) {
        step += 1;
        const response = await post(path, `198.51.100.${String(70 + step)}`, { origin });
        expect(response.status).toBe(403);
        expect(response.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
        problemDetailsSchema.parse(await response.json());
      }
    }
    expect((await post("", "198.51.100.79")).status).toBe(201);
  });

  it("keeps foreign withdraw posts from spending the rate limit", async ({ expect }) => {
    const post = harness();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const foreign = await post("/withdraw", "198.51.100.90", { origin: "https://attacker.test" });
      expect(foreign.status).toBe(403);
    }
    expect((await post("/withdraw", "198.51.100.90", { body: "{}" })).status).toBe(404);
  });
});
