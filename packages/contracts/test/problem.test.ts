import fc from "fast-check";
import { describe, it } from "vitest";

import { PROBLEM_CONTENT_TYPE, problemDetailsSchema } from "../src/problem.ts";

const valid = {
  type: "about:blank",
  title: "Not Found",
  status: 404,
  requestId: "0199f2a4-1c2b-7d3e-8f40-1234567890ab",
};

describe("PROBLEM_CONTENT_TYPE", () => {
  it("is the RFC 9457 media type", ({ expect }) => {
    expect(PROBLEM_CONTENT_TYPE).toBe("application/problem+json");
  });
});

describe("problemDetailsSchema", () => {
  it("accepts a minimal problem", ({ expect }) => {
    expect(problemDetailsSchema.parse(valid)).toEqual(valid);
  });

  it("accepts an optional detail", ({ expect }) => {
    expect(problemDetailsSchema.parse({ ...valid, detail: "Missing" }).detail).toBe("Missing");
  });

  it("rejects unknown keys", ({ expect }) => {
    expect(problemDetailsSchema.safeParse({ ...valid, stack: "trace" }).success).toBe(false);
  });

  it("rejects empty text fields", ({ expect }) => {
    expect(problemDetailsSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
    expect(problemDetailsSchema.safeParse({ ...valid, type: "" }).success).toBe(false);
    expect(problemDetailsSchema.safeParse({ ...valid, detail: "" }).success).toBe(false);
  });

  it("rejects a malformed request id", ({ expect }) => {
    expect(problemDetailsSchema.safeParse({ ...valid, requestId: "abc" }).success).toBe(false);
  });

  it("accepts every error status and nothing else", ({ expect }) => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 2000 }), (status) => {
        const accepted = problemDetailsSchema.safeParse({ ...valid, status }).success;
        expect(accepted).toBe(status >= 400 && status <= 599);
      }),
    );
  });
});
