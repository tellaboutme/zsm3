import { PROBLEM_CONTENT_TYPE, problemDetailsSchema } from "@zsm3/contracts/problem";
import { HTTPException } from "hono/http-exception";
import { describe, it, vi } from "vitest";

import { ORIGIN, send } from "./support.ts";
import { createApp, MAX_BODY_BYTES } from "../src/app.ts";
import { REQUEST_ID_HEADER } from "../src/http/request-id.ts";

describe("problem responses", () => {
  it("answers unknown API routes with a 404 problem", async ({ expect }) => {
    const response = await send("/api/unknown");
    const problem = problemDetailsSchema.parse(await response.json());

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
    expect(problem).toMatchObject({ type: "about:blank", title: "Not Found", status: 404 });
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(problem.requestId);
  });

  it("rejects oversized bodies with a 413 problem", async ({ expect }) => {
    const response = await send("/api/health", {
      method: "POST",
      body: "x".repeat(MAX_BODY_BYTES + 1),
    });
    const problem = problemDetailsSchema.parse(await response.json());

    expect(response.status).toBe(413);
    expect(problem.title).toBe("Content Too Large");
  });

  it("accepts a body of exactly 16 KiB", async ({ expect }) => {
    const response = await send("/api/health", { method: "POST", body: "x".repeat(16 * 1024) });

    expect(response.status).toBe(404);
  });

  it("hides internal errors behind a 500 problem and logs no details", async ({ expect }) => {
    const app = createApp();
    app.get("/api/failure", () => {
      throw new TypeError("secret detail");
    });
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await app.request(`${ORIGIN}/api/failure`);
    const body = await response.text();
    const problem = problemDetailsSchema.parse(JSON.parse(body));

    expect(response.status).toBe(500);
    expect(body).not.toContain("secret detail");
    expect(logged).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        event: "unhandled_error",
        requestId: problem.requestId,
        errorName: "TypeError",
      }),
    );
    logged.mockRestore();
  });
});

describe("HTTP exceptions", () => {
  it("maps a known status to its problem", async ({ expect }) => {
    const app = createApp();
    app.get("/api/gone", () => {
      throw new HTTPException(404);
    });

    const response = await app.request(`${ORIGIN}/api/gone`);

    expect(problemDetailsSchema.parse(await response.json()).status).toBe(404);
  });

  it("treats an unmapped status as an internal error", async ({ expect }) => {
    const app = createApp();
    app.get("/api/teapot", () => {
      throw new HTTPException(418);
    });
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await app.request(`${ORIGIN}/api/teapot`);

    expect(response.status).toBe(500);
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });
});

describe("request id", () => {
  it("ignores a client supplied id", async ({ expect }) => {
    const response = await send("/api/health", { headers: { [REQUEST_ID_HEADER]: "forged-id" } });

    expect(response.headers.get(REQUEST_ID_HEADER)).not.toBe("forged-id");
    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u,
    );
  });

  it("is unique per request", async ({ expect }) => {
    const [first, second] = await Promise.all([send("/api/health"), send("/api/health")]);

    expect(first.headers.get(REQUEST_ID_HEADER)).not.toBe(second.headers.get(REQUEST_ID_HEADER));
  });
});
