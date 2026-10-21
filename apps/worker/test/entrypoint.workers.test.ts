import { exports } from "cloudflare:workers";
import { describe, it } from "vitest";

import { ORIGIN } from "./support.ts";

describe("worker entrypoint", () => {
  it("routes API requests through the application", async ({ expect }) => {
    const response = await exports.default.fetch(new Request(`${ORIGIN}/api/health`));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
