import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterAll, beforeAll, describe, it, vi } from "vitest";

import { outboundUrl } from "./requests-workers-helpers.ts";
import { QUESTION_ACCEPTED_LIMIT, QUESTION_ATTEMPT_LIMIT } from "../src/questions/submit.ts";
import { createQuestionsApp } from "../src/questions-app.ts";
import { QUESTION_TURNSTILE_ACTION, TURNSTILE_VERIFY_URL } from "../src/security/turnstile.ts";

const ORIGIN = "https://zsm3.test";
const SENDER = "198.51.100.40";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  vi.stubGlobal("fetch", async (input: RequestInfo | URL): Promise<Response> => {
    if (outboundUrl(input) !== TURNSTILE_VERIFY_URL) {
      return Promise.reject(new Error(`Unexpected outbound fetch: ${outboundUrl(input)}`));
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          success: true,
          action: QUESTION_TURNSTILE_ACTION,
          hostname: "zsm3.test",
          challenge_ts: new Date(Date.now() - 1000).toISOString(),
        }),
      ),
    );
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

async function ask(): Promise<Response> {
  const formKey = crypto.randomUUID();
  return createQuestionsApp().request(
    `${ORIGIN}/api/questions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN, "CF-Connecting-IP": SENDER },
      body: JSON.stringify({
        addressee: "pedagogue",
        question: "Jak poprosić o rozmowę, żeby nikt w klasie się nie dowiedział?",
        rulesAccepted: true,
        honeypot: "",
        formKey,
        turnstileToken: "tok",
      }),
    },
    { ...env, SKRZYNKA_ENABLED: "true" },
  );
}

describe("Skrzynka privacy on D1", () => {
  it("stores questions without an implicit row number", async ({ expect }) => {
    const table = await env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'questions'",
    ).first<string>("sql");

    expect(table).toMatch(/\) WITHOUT ROWID$/u);
    await expect(env.DB.prepare("SELECT rowid FROM questions").all()).rejects.toThrow(/rowid/u);
  });

  it("holds both limits under a burst from one address", async ({ expect }) => {
    const burst = QUESTION_ATTEMPT_LIMIT + QUESTION_ACCEPTED_LIMIT;

    const statuses = await Promise.all(
      Array.from({ length: burst }, async () => (await ask()).status),
    );
    const stored = await env.DB.prepare("SELECT count(*) AS total FROM questions").first<number>(
      "total",
    );
    const slots = await env.DB.prepare(
      "SELECT DISTINCT window_started_at AS slot FROM rate_limits",
    ).all<{ slot: string }>();

    expect(statuses.filter((status) => status === 202)).toHaveLength(QUESTION_ACCEPTED_LIMIT);
    expect(statuses.filter((status) => status === 429)).toHaveLength(
      burst - QUESTION_ACCEPTED_LIMIT,
    );
    expect(stored).toBe(QUESTION_ACCEPTED_LIMIT);
    for (const { slot } of slots.results) {
      expect(slot).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d0:00\.000Z$/u);
    }
    expect(JSON.stringify(slots.results)).not.toContain(SENDER);
  });
});
