import { problemDetailsSchema, PROBLEM_CONTENT_TYPE } from "@zsm3/contracts/problem";
import { statusResponseSchema, submissionResponseSchema } from "@zsm3/contracts/requests";
import { env } from "cloudflare:workers";
import { describe, it, vi } from "vitest";

import { body, formKey, jsonPost, ORIGIN } from "./requests-workers-harness.ts";
import { createRequestsApp } from "../src/requests-app.ts";
import { tokenHash } from "../src/security/tokens.ts";
import { liveStore } from "../src/storage/database.ts";
import { requestsRepo } from "../src/storage/requests-repo.ts";

describe("POST /api/requests/status", () => {
  it("limits guesses independently from withdrawal and submission", async ({ expect }) => {
    const ip = "198.51.100.201";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        (await jsonPost("/api/requests/status", JSON.stringify({ token: "a".repeat(43) }), ip))
          .status,
      ).toBe(404);
    }
    const limited = await jsonPost("/api/requests/status", "{}", ip);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
    problemDetailsSchema.parse(await limited.json());
    expect((await jsonPost("/api/requests/withdraw", "{}", ip)).status).toBe(404);
  });
  it("rejects invalid media types and malformed json", async ({ expect }) => {
    const wrongType = await createRequestsApp().request(
      `${ORIGIN}/api/requests/status`,
      { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" },
      env,
    );
    const invalid = await jsonPost("/api/requests/status", "{", "198.51.100.54");
    expect(wrongType.status).toBe(415);
    expect(invalid.status).toBe(400);
  });
  it("reports the stored status for a valid token", async ({ expect }) => {
    const created = await jsonPost("/api/requests", body(), "198.51.100.50");
    const statusUrl = submissionResponseSchema.parse(await created.json()).statusUrl;
    const token = statusUrl.split("#")[1] ?? "";

    const response = await jsonPost(
      "/api/requests/status",
      JSON.stringify({ token }),
      "198.51.100.51",
    );

    expect(response.status).toBe(200);
    const record = await requestsRepo(liveStore(env.DB)).findByTokenHash(await tokenHash(token));
    if (record === undefined) return expect.unreachable();
    const result = statusResponseSchema.parse(await response.json());
    expect(result).toEqual({
      type: "STUDENT_ID_RENEWAL",
      status: "submitted",
      updatedAt: record.updatedAt,
      collectionMessage: "",
    });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain("jan@example.com");
  });

  it("hides unknown or malformed tokens behind a 404", async ({ expect }) => {
    const unknown = await jsonPost(
      "/api/requests/status",
      JSON.stringify({ token: "b".repeat(43) }),
      "198.51.100.52",
    );
    const malformed = await jsonPost(
      "/api/requests/status",
      JSON.stringify({ token: "short" }),
      "198.51.100.53",
    );

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });
});

describe("POST /api/requests/withdraw", () => {
  it("races cron rejection without returning a false withdrawal or erasing the winner", async ({
    expect,
  }) => {
    const key = formKey();
    const created = await jsonPost("/api/requests", body({ formKey: key }), "198.51.100.168");
    const token =
      submissionResponseSchema.parse(await created.json()).statusUrl.split("#")[1] ?? "";
    const repo = requestsRepo(liveStore(env.DB));
    const record = await repo.findByTokenHash(await tokenHash(token));
    if (record === undefined) return expect.unreachable();
    const at = new Date().toISOString();
    const [withdrawal] = await Promise.all([
      jsonPost("/api/requests/withdraw", JSON.stringify({ token }), "198.51.100.169"),
      repo.closeInactive([record.id], at, new Date(Date.now() + 60_000).toISOString()),
    ]);
    const final = await repo.findById(record.id);
    if (final?.status === "withdrawn") {
      expect(withdrawal.status).toBe(200);
      expect(final.piiCiphertext).toBeNull();
    } else {
      expect(final?.status).toBe("rejected");
      expect(withdrawal.status).toBe(409);
      expect(final?.piiCiphertext).not.toBeNull();
    }
  });
  it("limits withdrawal guesses independently", async ({ expect }) => {
    const ip = "198.51.100.202";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await jsonPost("/api/requests/withdraw", "{}", ip)).status).toBe(404);
    }
    const limited = await jsonPost("/api/requests/withdraw", "{}", ip);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
    expect((await jsonPost("/api/requests/status", "{}", ip)).status).toBe(404);
  });
  it("rejects invalid media types and malformed json", async ({ expect }) => {
    const wrongType = await createRequestsApp().request(
      `${ORIGIN}/api/requests/withdraw`,
      { method: "POST", headers: { "Content-Type": "text/plain", Origin: ORIGIN }, body: "{}" },
      env,
    );
    const invalid = await jsonPost("/api/requests/withdraw", "{", "198.51.100.66");
    expect(wrongType.status).toBe(415);
    expect(invalid.status).toBe(400);
  });
  it("withdraws a request, erases its pii and stays idempotent", async ({ expect }) => {
    const created = await jsonPost(
      "/api/requests",
      body({ email: "wycofanie@example.com" }),
      "198.51.100.60",
    );
    const token =
      submissionResponseSchema.parse(await created.json()).statusUrl.split("#")[1] ?? "";

    const first = await jsonPost(
      "/api/requests/withdraw",
      JSON.stringify({ token }),
      "198.51.100.61",
    );
    const second = await jsonPost(
      "/api/requests/withdraw",
      JSON.stringify({ token }),
      "198.51.100.62",
    );

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ status: "withdrawn" });
    expect(second.status).toBe(200);
  });

  it("answers 404 for an unknown token and 409 for a closed request", async ({ expect }) => {
    const missing = await jsonPost(
      "/api/requests/withdraw",
      JSON.stringify({ token: "c".repeat(43) }),
      "198.51.100.63",
    );
    expect(missing.status).toBe(404);

    const key = formKey();
    const created = await jsonPost(
      "/api/requests",
      body({ formKey: key, email: "zamkniety@example.com" }),
      "198.51.100.64",
    );
    const token =
      submissionResponseSchema.parse(await created.json()).statusUrl.split("#")[1] ?? "";
    await env.DB.prepare(
      "UPDATE requests SET status = 'collected', closed_at = ?1 WHERE form_key = ?2",
    )
      .bind(new Date().toISOString(), key)
      .run();
    const closed = await jsonPost(
      "/api/requests/withdraw",
      JSON.stringify({ token }),
      "198.51.100.65",
    );

    expect(closed.status).toBe(409);
  });
});

describe("requests app surface", () => {
  it("answers unknown paths with a uniform 404 problem", async ({ expect }) => {
    const response = await jsonPost("/api/requests/unknown", "{}", "198.51.100.70");

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
    problemDetailsSchema.parse(await response.json());
  });

  it("hides internal errors behind a 500 problem", async ({ expect }) => {
    const app = createRequestsApp();
    app.post("/api/requests/boom", () => {
      throw new TypeError("secret detail");
    });
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await app.request(`${ORIGIN}/api/requests/boom`, { method: "POST" }, env);
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).not.toContain("secret detail");
    expect(logged).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        event: "unhandled_error",
        requestId: problemDetailsSchema.parse(JSON.parse(body)).requestId,
        errorName: "TypeError",
      }),
    );
    logged.mockRestore();
  });
});
