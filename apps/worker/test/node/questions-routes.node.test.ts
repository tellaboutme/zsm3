import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { memoryDatabase } from "./memory-database.ts";
import { expectedApiHeaders } from "../expected-api-headers.ts";
import { questionBody } from "./questions-harness.ts";
import { SECRETS } from "./request-harness.ts";
import type { AppBindings } from "../../src/app-env.ts";
import { questionsEnabled } from "../../src/questions/config.ts";
import { MAX_QUESTION_BODY_BYTES, createQuestionsApp } from "../../src/questions-app.ts";
import { QUESTION_TURNSTILE_ACTION } from "../../src/security/turnstile.ts";

const ORIGIN = "https://zsm3.test";

function bindings(overrides: Partial<AppBindings> = {}): AppBindings {
  return {
    ...SECRETS,
    DB: memoryDatabase(),
    MEDIA: { get: async () => Promise.resolve(null), put: async () => Promise.resolve(null) },
    PANEL_ORIGIN: ORIGIN,
    ACCESS_TEAM_DOMAIN: "",
    ACCESS_AUDIENCE: "",
    SKRZYNKA_ENABLED: "true",
    ...overrides,
  };
}

async function post(
  env: AppBindings,
  body: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return createQuestionsApp().request(
    `${ORIGIN}/api/questions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGIN,
        "CF-Connecting-IP": "203.0.113.50",
        ...headers,
      },
      body,
    },
    env,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", async () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          success: true,
          action: QUESTION_TURNSTILE_ACTION,
          hostname: "zsm3.test",
          challenge_ts: new Date(Date.now() - 1000).toISOString(),
        }),
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function body(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify(questionBody({ submittedAtMs: Date.now() - 10_000, ...overrides }));
}

describe("the public question endpoint", () => {
  it("accepts a question without echoing anything back", async ({ expect }) => {
    const response = await post(bindings(), body());

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ received: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    for (const [name, value] of Object.entries(expectedApiHeaders)) {
      expect(response.headers.get(name), name).toBe(value);
    }
    const refused = await post(bindings(), body(), { Origin: "https://evil.test" });
    for (const [name, value] of Object.entries(expectedApiHeaders)) {
      expect(refused.headers.get(name), name).toBe(value);
    }
  });

  it("still rate-limits a sender whose address the edge did not pass on", async ({ expect }) => {
    const env = bindings();
    const statuses = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await createQuestionsApp().request(
        `${ORIGIN}/api/questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: ORIGIN },
          body: body(),
        },
        env,
      );
      statuses.push(response.status);
    }

    expect(statuses).toEqual([202, 202, 202, 429]);
  });

  it("is closed unless the school switched it on", async ({ expect }) => {
    const statuses = [];
    for (const flag of [undefined, "", "false", "TRUE", " true "]) {
      statuses.push((await post(bindings({ SKRZYNKA_ENABLED: flag }), body())).status);
    }

    expect(statuses).toEqual([404, 404, 404, 404, 202]);
    expect(questionsEnabled({})).toBe(false);
  });

  it("refuses cross-site, non-JSON, malformed and oversized posts", async ({ expect }) => {
    const env = bindings();
    const statuses = [
      (await post(env, body(), { Origin: "https://evil.test" })).status,
      (await post(env, body(), { Origin: "not a url" })).status,
      (await post(env, body(), { "Content-Type": "text/plain" })).status,
      (await post(env, "{", {})).status,
      (await post(env, body({ question: "a".repeat(MAX_QUESTION_BODY_BYTES) }))).status,
    ];

    expect(statuses).toEqual([403, 403, 415, 400, 413]);
  });

  it("maps refusals to problem responses", async ({ expect }) => {
    const env = bindings();
    const invalid = await post(env, body({ question: "krótko" }));
    const trap = await post(env, body({ submittedAtMs: Date.now() }));
    vi.stubGlobal("fetch", async () => Promise.resolve(new Response("{}", { status: 500 })));
    const challenge = await post(env, body());
    const limited = await post(env, body());

    expect([invalid.status, trap.status, challenge.status, limited.status]).toEqual([
      400, 400, 403, 429,
    ]);
    expect(invalid.headers.get("content-type")).toBe("application/problem+json");
  });

  it("answers 503 when its secrets are missing", async ({ expect }) => {
    const missingSalt = await post(bindings({ RATE_LIMIT_SALT: undefined }), body());
    const missingKey = await post(
      bindings({ PII_KEY_PRIMARY: undefined, PII_KEY_SECONDARY: "s".repeat(32) }),
      body(),
    );

    expect([missingSalt.status, missingKey.status]).toEqual([503, 503]);
  });

  it("hides unknown paths and logs unexpected failures without content", async ({ expect }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = bindings({
      DB: {
        prepare: () => {
          throw new TypeError("database down");
        },
        batch: async () => Promise.reject(new TypeError("database down")),
      },
    });

    const unknown = await createQuestionsApp().request(`${ORIGIN}/api/questions/1`, {}, broken);
    const failed = await post(broken, body());

    expect([unknown.status, failed.status]).toEqual([404, 500]);
    expect(logged.mock.calls.flat().join(" ")).not.toContain("stresem");
    expect(logged.mock.calls.flat().join(" ")).toContain('"errorName":"TypeError"');
  });
});
