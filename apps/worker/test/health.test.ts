import { healthResponseSchema } from "@zsm3/contracts/health";
import { describe, it } from "vitest";

import { send } from "./support.ts";

describe("GET /api/health", () => {
  it("reports ok as JSON", async ({ expect }) => {
    const response = await send("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(healthResponseSchema.parse(await response.json())).toEqual({ status: "ok" });
  });
});
