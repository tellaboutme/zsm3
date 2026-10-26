import { describe, it, vi } from "vitest";

import { routeLegacyRequest } from "../worker/legacy-route.ts";

describe("legacy Worker routing", () => {
  it("passes successful pages and non-read methods through without a lookup", async ({
    expect,
  }) => {
    const lookup = vi.fn(() => "/kontakt");
    const page = new Response("page");
    const missing = new Response("missing", { status: 405 });

    expect(
      await routeLegacyRequest(
        new Request("https://example.test/kontakt"),
        page,
        lookup,
        () => true,
      ),
    ).toBe(page);
    expect(
      await routeLegacyRequest(
        new Request("https://example.test/old", { method: "POST" }),
        missing,
        lookup,
        () => true,
      ),
    ).toBe(missing);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("returns the original 404 when the lookup fails or has no safe target", async ({ expect }) => {
    const missing = new Response("not found", { status: 404 });
    expect(
      await routeLegacyRequest(
        new Request("https://example.test/old"),
        missing,
        () => undefined,
        () => true,
      ),
    ).toBe(missing);
    expect(
      await routeLegacyRequest(
        new Request("https://example.test/old"),
        missing,
        () => {
          throw new Error("database unavailable");
        },
        () => true,
      ),
    ).toBe(missing);
    expect(
      await routeLegacyRequest(
        new Request("https://example.test/old"),
        missing,
        (path): string | Promise<string> =>
          path === "/old" ? "/second" : Promise.reject(new Error("database unavailable")),
        () => false,
      ),
    ).toBe(missing);
    expect(
      await routeLegacyRequest(
        new Request("https://example.test/old"),
        missing,
        () => "/missing",
        () => false,
      ),
    ).toBe(missing);
    expect(
      await routeLegacyRequest(
        new Request("https://example.test/old"),
        missing,
        () => "/kontakt",
        () => {
          throw new Error("Astro unavailable");
        },
      ),
    ).toBe(missing);
  });

  it("returns a bodyless 301 with page headers for GET and HEAD", async ({ expect }) => {
    for (const method of ["GET", "HEAD"]) {
      const request = new Request("https://example.test/old?tracking=1", { method });
      const response = await routeLegacyRequest(
        request,
        new Response(null, { status: 404 }),
        (path) => (path === "/old" ? "/kontakt" : undefined),
        () => true,
      );
      expect(response.status).toBe(301);
      expect(response.headers.get("Location")).toBe("/kontakt");
      expect(response.headers.get("Strict-Transport-Security")).toBe(
        "max-age=63072000; includeSubDomains; preload",
      );
      expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
      expect(await response.text()).toBe("");
    }
  });
});
