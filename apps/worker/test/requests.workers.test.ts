import { problemDetailsSchema, PROBLEM_CONTENT_TYPE } from "@zsm3/contracts/problem";
import { submissionResponseSchema } from "@zsm3/contracts/requests";
import { env } from "cloudflare:workers";
import { describe, it } from "vitest";

import { body, formKey, jsonPost, request } from "./requests-workers-harness.ts";
import { REQUEST_ID_HEADER } from "../src/http/request-id.ts";
import { createRequestsApp, MAX_REQUEST_BODY_BYTES } from "../src/requests-app.ts";

describe("POST /api/requests", () => {
  it("rejects a missing content type and uses an empty ip when the header is absent", async ({
    expect,
  }) => {
    const missingType = await request("/api/requests", { method: "POST" });
    const withoutIp = await request("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body({ turnstileToken: "" }),
    });

    expect(missingType.status).toBe(415);
    expect(withoutIp.status).toBe(400);
  });

  it("creates a request with a status link and hardening headers", async ({ expect }) => {
    const response = await jsonPost("/api/requests", body(), "198.51.100.1");

    expect(response.status).toBe(201);
    const submission = submissionResponseSchema.parse(await response.json());
    expect(submission.statusUrl).toMatch(/^https:\/\/zsm3\.test\/e-wniosek\/status#[\w-]{43}$/u);
    expect(response.headers.get(REQUEST_ID_HEADER)).not.toBeNull();
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("answers a repeated form key without the stored status token", async ({ expect }) => {
    const payload = body();
    const first = await jsonPost("/api/requests", payload, "198.51.100.2");
    const second = await jsonPost("/api/requests", payload, "198.51.100.3");

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const duplicate = submissionResponseSchema.parse(await second.json());
    expect(duplicate.statusUrl).toBe("https://zsm3.test/e-wniosek/status");
    expect(duplicate.statusUrl).not.toBe(
      submissionResponseSchema.parse(await first.json()).statusUrl,
    );
  });

  it("refuses another email using an existing form key", async ({ expect }) => {
    const key = formKey();
    const first = await jsonPost("/api/requests", body({ formKey: key }), "198.51.100.61");
    const different = await jsonPost(
      "/api/requests",
      body({ formKey: key, email: "different@example.com" }),
      "198.51.100.62",
    );

    expect(first.status).toBe(201);
    expect(different.status).toBe(400);
    expect(different.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
    expect(JSON.stringify(await different.json())).not.toContain("statusUrl");
  });

  it("rolls back request and both messages when the second insert fails", async ({ expect }) => {
    const key = formKey();
    const before = await env.DB.prepare("SELECT count(*) AS total FROM email_outbox").first<{
      total: number;
    }>();
    await env.DB.prepare(
      `CREATE TRIGGER fail_second_mail BEFORE INSERT ON email_outbox
      WHEN NEW.kind = 'SECRETARIAT_NOTICE' BEGIN SELECT RAISE(ABORT, 'mail failure'); END`,
    ).run();
    try {
      const response = await jsonPost(
        "/api/requests",
        body({ formKey: key, email: `rollback-${key}@example.com` }),
        "198.51.100.63",
      );
      const requests = await env.DB.prepare(
        "SELECT count(*) AS total FROM requests WHERE form_key = ?",
      )
        .bind(key)
        .first<{ total: number }>();
      const messages = await env.DB.prepare("SELECT count(*) AS total FROM email_outbox").first<{
        total: number;
      }>();

      expect(response.status).toBe(500);
      expect(requests?.total).toBe(0);
      expect(messages?.total).toBe(before?.total);
    } finally {
      await env.DB.exec("DROP TRIGGER fail_second_mail");
    }
  });

  it("limits four concurrent submissions for the same email to three", async ({ expect }) => {
    const email = `parallel-${formKey()}@example.com`;
    const keys = Array.from({ length: 4 }, () => formKey());
    const responses = await Promise.all(
      keys.map(async (key, index) =>
        jsonPost("/api/requests", body({ email, formKey: key }), `198.51.100.7${String(index)}`),
      ),
    );
    const rows = await env.DB.prepare(
      "SELECT count(*) AS total FROM requests WHERE form_key IN (?1, ?2, ?3, ?4)",
    )
      .bind(...keys)
      .first<{ total: number }>();

    expect(responses.filter((response) => response.status === 201)).toHaveLength(3);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(rows?.total).toBe(3);
  });

  it("rejects a filled honeypot, a too fast bot and broken payloads", async ({ expect }) => {
    const honeypot = await jsonPost("/api/requests", body({ honeypot: "spam" }), "198.51.100.4");
    const tooFast = await jsonPost(
      "/api/requests",
      body({ submittedAtMs: Date.now() - 100 }),
      "198.51.100.5",
    );
    const unknownType = await jsonPost("/api/requests", body({ type: "OTHER" }), "198.51.100.6");
    const badJson = await jsonPost("/api/requests", "{not-json", "198.51.100.7");

    for (const response of [honeypot, tooFast, unknownType, badJson]) {
      expect(response.status).toBe(400);
      expect(response.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
      problemDetailsSchema.parse(await response.json());
    }
  });

  it("rejects a missing turnstile token, an oversized body and wrong media types", async ({
    expect,
  }) => {
    const noToken = await jsonPost("/api/requests", body({ turnstileToken: "" }), "198.51.100.8");
    const oversized = await jsonPost(
      "/api/requests",
      `x`.repeat(MAX_REQUEST_BODY_BYTES + 1),
      "198.51.100.9",
    );
    const wrongType = await request("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "text/plain", "CF-Connecting-IP": "198.51.100.10" },
      body: body(),
    });

    expect(noToken.status).toBe(400);
    expect(oversized.status).toBe(413);
    expect(wrongType.status).toBe(415);
  });

  it("answers 403 when the turnstile hostname does not match", async ({ expect }) => {
    const response = await createRequestsApp().request(
      `https://evil.test/api/requests`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.11" },
        body: body(),
      },
      env,
    );

    expect(response.status).toBe(403);
    problemDetailsSchema.parse(await response.json());
  });

  it("answers 409 once an e-mail has three open requests", async ({ expect }) => {
    const email = "trzy-wnioski@example.com";
    for (let index = 0; index < 3; index += 1) {
      const created = await jsonPost(
        "/api/requests",
        body({ email, formKey: formKey() }),
        `198.51.100.20${String(index)}`,
      );
      expect(created.status).toBe(201);
    }
    const fourth = await jsonPost(
      "/api/requests",
      body({ email, formKey: formKey() }),
      "198.51.100.204",
    );

    expect(fourth.status).toBe(409);
  });

  it("throttles the sixth submit of one ip", async ({ expect }) => {
    for (let index = 0; index < 5; index += 1) {
      await jsonPost("/api/requests", body({ turnstileToken: "" }), "198.51.100.300");
    }
    const sixth = await jsonPost("/api/requests", body({ turnstileToken: "" }), "198.51.100.300");

    expect(sixth.status).toBe(429);
    problemDetailsSchema.parse(await sixth.json());
  });

  it("answers 503 when a secret is broken", async ({ expect }) => {
    const brokenEnv = { ...env, EMAIL_INDEX_KEY: "" };

    const response = await request(
      "/api/requests",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.40" },
        body: body(),
      },
      brokenEnv,
    );

    expect(response.status).toBe(503);
  });
});
