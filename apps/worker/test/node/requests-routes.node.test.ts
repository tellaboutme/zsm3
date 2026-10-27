import { problemDetailsSchema, PROBLEM_CONTENT_TYPE } from "@zsm3/contracts/problem";
import { submissionResponseSchema } from "@zsm3/contracts/requests";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { memoryDatabase } from "./memory-database.ts";
import { ORIGIN, SECRETS, submitBody } from "./request-harness.ts";
import { createRequestsApp, MAX_REQUEST_BODY_BYTES } from "../../src/requests-app.ts";

const app = createRequestsApp();

function harness() {
  const DB = memoryDatabase();
  const env = { ...SECRETS, DB, MEDIA: { get: async () => await Promise.resolve(null) } };
  const post = async (
    path: string,
    body: string,
    ip = "198.51.100.10",
    contentType = "application/json",
  ): Promise<Response> =>
    await app.request(
      `${ORIGIN}/api/requests${path}`,
      { method: "POST", headers: { "Content-Type": contentType, "CF-Connecting-IP": ip }, body },
      env,
    );
  return { DB, env, post };
}

function payload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify(submitBody({ submittedAtMs: Date.now() - 5000, ...overrides }));
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

describe("request HTTP routes in Node", () => {
  it("validates JSON and refuses invalid, trapped and foreign challenges", async ({ expect }) => {
    const { post } = harness();
    expect((await post("", "{}", "1", "text/plain")).status).toBe(415);
    expect((await post("", "{", "2")).status).toBe(400);
    const probe = await post("", payload(), "3");
    expect(fetch).toHaveBeenCalled();
    expect(probe.status).toBe(201);
    expect((await post("", payload({ honeypot: "spam" }), "6")).status).toBe(400);
    expect((await post("", payload({ submittedAtMs: Date.now() }), "4")).status).toBe(400);
    expect((await post("", payload({ type: "INVALID" }), "5")).status).toBe(400);
    const foreign = await app.request(
      "https://foreign.test/api/requests",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: payload() },
      { ...SECRETS, DB: memoryDatabase(), MEDIA: { get: async () => await Promise.resolve(null) } },
    );
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
    problemDetailsSchema.parse(await foreign.json());
  });

  it("creates, deduplicates, limits open requests and rate limits by ip", async ({ expect }) => {
    const { post } = harness();
    const formKey = crypto.randomUUID();
    const body = payload({ formKey });
    const created = await post("", body);
    const link = submissionResponseSchema.parse(await created.json()).statusUrl;
    expect(created.status).toBe(201);
    expect(link).toMatch(/#[\w-]{43}$/u);
    expect(created.headers.get("Cache-Control")).toBe("no-store");
    const duplicate = await post("", body, "198.51.100.11");
    expect(duplicate.status).toBe(200);
    expect(submissionResponseSchema.parse(await duplicate.json()).statusUrl).toBe(
      `${ORIGIN}/e-wniosek/status`,
    );
    const otherEmail = await post(
      "",
      payload({ formKey, email: "other@example.com" }),
      "198.51.100.12",
    );
    expect(otherEmail.status).toBe(400);
    for (let index = 0; index < 2; index += 1) {
      expect((await post("", payload(), `198.51.100.${String(20 + index)}`)).status).toBe(201);
    }
    expect((await post("", payload(), "198.51.100.22")).status).toBe(409);
    for (let index = 0; index < 5; index += 1) {
      expect((await post("", "{}", "198.51.100.30")).status).toBe(400);
    }
    expect((await post("", "{}", "198.51.100.30")).status).toBe(429);
    expect((await post("", "x".repeat(MAX_REQUEST_BODY_BYTES + 1), "198.51.100.31")).status).toBe(
      413,
    );
  });

  it("checks, withdraws and hides unknown tokens with independent throttles", async ({
    expect,
  }) => {
    const { post } = harness();
    const created = await post("", payload());
    const token = submissionResponseSchema.parse(await created.json()).statusUrl.split("#")[1];
    const valid = JSON.stringify({ token });
    const status = await post("/status", valid);
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ type: "STUDENT_ID_RENEWAL", status: "submitted" });
    expect((await post("/status", "{}", "198.51.100.41", "text/plain")).status).toBe(415);
    expect((await post("/status", "{", "198.51.100.42")).status).toBe(400);
    expect(
      (await post("/status", JSON.stringify({ token: "a".repeat(43) }), "198.51.100.43")).status,
    ).toBe(404);
    expect((await post("/withdraw", "{}", "198.51.100.44", "text/plain")).status).toBe(415);
    expect((await post("/withdraw", "{", "198.51.100.45")).status).toBe(400);
    expect(
      (await post("/withdraw", JSON.stringify({ token: "b".repeat(43) }), "198.51.100.46")).status,
    ).toBe(404);
    const withdrawn = await post("/withdraw", valid);
    expect(withdrawn.status).toBe(200);
    expect(await withdrawn.json()).toEqual({ status: "withdrawn" });
    expect((await post("/withdraw", valid, "198.51.100.47")).status).toBe(200);
    for (const path of ["/status", "/withdraw"]) {
      for (let index = 0; index < 5; index += 1) {
        expect(
          (await post(path, "{}", `198.51.100.${path === "/status" ? "51" : "52"}`)).status,
        ).toBe(404);
      }
      expect(
        (await post(path, "{}", `198.51.100.${path === "/status" ? "51" : "52"}`)).status,
      ).toBe(429);
    }
    expect((await post("/unknown", "{}")).status).toBe(404);
  });

  it("rejects withdrawal after collection and returns a service error for missing secrets", async ({
    expect,
  }) => {
    const { DB, env, post } = harness();
    const formKey = crypto.randomUUID();
    const created = await post("", payload({ formKey }));
    const token = submissionResponseSchema.parse(await created.json()).statusUrl.split("#")[1];
    DB.sqlite
      .prepare("UPDATE requests SET status = 'collected', closed_at = ? WHERE form_key = ?")
      .run(new Date().toISOString(), formKey);
    expect((await post("/withdraw", JSON.stringify({ token }))).status).toBe(409);
    const unavailable = await app.request(
      `${ORIGIN}/api/requests`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: payload() },
      { ...env, EMAIL_INDEX_KEY: "" },
    );
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
  });
});
