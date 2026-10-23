import { expect, test } from "./fixtures.ts";

const contentSecurityPolicy =
  /^default-src 'none'; script-src 'self' 'sha256-[\w+/]{43}='; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none'$/u;

const pageHeaders = {
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
    for (const path of ["/", "/kontakt", "/aktualnosci", "/nie-istnieje", "/robots.txt"]) {
      const response = await request.get(path);
      const headers = response.headers();

      expect(headers["content-security-policy"], `${path} content-security-policy`).toMatch(
        contentSecurityPolicy,
      );

      for (const [name, value] of Object.entries(pageHeaders)) {
        expect(headers[name], `${path} ${name}`).toBe(value);
      }
    }
  });

  test("pages rendered on demand revalidate and accept only reads", async ({ request }) => {
    const page = await request.get("/aktualnosci");
    const missing = await request.get("/aktualnosci/kategoria/nie-ma-takiej");
    const posted = await request.post("/aktualnosci");

    expect(page.status()).toBe(200);
    expect(page.headers()["cache-control"]).toBe("public, max-age=0, must-revalidate");
    expect(missing.status()).toBe(404);
    expect(await missing.text()).toContain("Nie znaleziono strony");
    expect(posted.status()).toBe(405);
    expect(posted.headers()["allow"]).toBe("GET, HEAD");
    expect(posted.headers()["content-security-policy"]).toMatch(contentSecurityPolicy);
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
