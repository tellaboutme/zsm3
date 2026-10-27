import { problemDetailsSchema, PROBLEM_CONTENT_TYPE } from "@zsm3/contracts/problem";
import { describe, it } from "vitest";

import { body, ORIGIN, request } from "./requests-workers-harness.ts";

const refusedOrigins: string[] = ["null", "https://attacker.test", "http://zsm3.test"];

async function post(path: string, ip: string, origin: string | null = ORIGIN): Promise<Response> {
  return await request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
      ...(origin === null ? {} : { Origin: origin }),
    },
    body: body(),
  });
}

describe("guards on the requests API", () => {
  it("rejects a missing content type and uses an empty ip when the header is absent", async ({
    expect,
  }) => {
    const missingType = await request("/api/requests", {
      method: "POST",
      headers: { Origin: ORIGIN },
    });
    const withoutIp = await request("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: body({ turnstileToken: "" }),
    });

    expect(missingType.status).toBe(415);
    expect(withoutIp.status).toBe(400);
  });

  it("answers 403 when submit or withdraw posts miss a same-origin header", async ({ expect }) => {
    let step = 0;
    for (const path of ["/api/requests", "/api/requests/withdraw"]) {
      for (const origin of [null, ...refusedOrigins]) {
        step += 1;
        const response = await post(path, `198.51.100.${String(81 + step)}`, origin);
        expect(response.status, `${path} ${origin ?? "missing"}`).toBe(403);
        expect(response.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
        problemDetailsSchema.parse(await response.json());
      }
    }
  });

  it("keeps foreign withdraw posts from spending the rate limit", async ({ expect }) => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const foreign = await post(
        "/api/requests/withdraw",
        "198.51.100.90",
        "https://attacker.test",
      );
      expect(foreign.status).toBe(403);
    }
    expect((await post("/api/requests/withdraw", "198.51.100.90")).status).toBe(404);
  });
});
