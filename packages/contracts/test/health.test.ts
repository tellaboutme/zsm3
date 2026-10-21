import { describe, it } from "vitest";

import { healthResponseSchema } from "../src/health.ts";

describe("healthResponseSchema", () => {
  it("accepts ok", ({ expect }) => {
    expect(healthResponseSchema.parse({ status: "ok" })).toEqual({ status: "ok" });
  });

  it("rejects any other status", ({ expect }) => {
    expect(healthResponseSchema.safeParse({ status: "degraded" }).success).toBe(false);
  });
});
