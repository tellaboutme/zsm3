import { expect, test } from "./fixtures.ts";

const pageHeaders = {
  "content-security-policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none'",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "cross-origin-embedder-policy": "require-corp",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
} as const;

test.describe("response headers", () => {
  test("pages carry the full security policy", async ({ request }) => {
    for (const path of ["/", "/nie-istnieje", "/robots.txt"]) {
      const response = await request.get(path);
      const headers = response.headers();

      for (const [name, value] of Object.entries(pageHeaders)) {
        expect(headers[name], `${path} ${name}`).toBe(value);
      }
    }
  });

  test("fingerprinted assets are cached forever", async ({ page, request }) => {
    await page.goto("/");
    const stylesheet = await page.locator('link[rel="stylesheet"]').first().getAttribute("href");

    expect(stylesheet).toMatch(/^\/_astro\//u);
    const response = await request.get(stylesheet ?? "");

    expect(response.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  test("the API is never cached", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
  });
});
