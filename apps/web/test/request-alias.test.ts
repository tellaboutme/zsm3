import { describe, expect, it } from "vitest";

import { requestAlias } from "../worker/request-alias.ts";

describe("request aliases", () => {
  it.each([
    ["/uczniowie/e-wniosek", "/e-wniosek"],
    ["/uczniowie/e-wniosek/status", "/e-wniosek/status"],
  ])("redirects %s to %s without a database lookup", async (source, target) => {
    for (const method of ["GET", "HEAD"]) {
      const response = await requestAlias(new Request(`https://zsm3.test${source}`, { method }));
      expect(response?.status).toBe(308);
      expect(response?.headers.get("Location")).toBe(target);
      expect(response?.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
      expect(response?.headers.get("Referrer-Policy")).toBe("no-referrer");
      expect(response?.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
    }
  });

  it("leaves unrelated paths and non-read methods alone", async ({ expect }) => {
    expect(await requestAlias(new Request("https://zsm3.test/e-wniosek"))).toBeUndefined();
    expect(
      await requestAlias(new Request("https://zsm3.test/uczniowie/e-wniosek", { method: "POST" })),
    ).toBeUndefined();
  });
});
