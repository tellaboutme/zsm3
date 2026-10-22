import { createHash } from "node:crypto";

import { describe, it } from "vitest";

import { bootScript } from "../src/lib/preferences.ts";
import {
  contentSecurityPolicy,
  pageHeaders,
  renderHeaders,
  sha256Base64,
  sitePageHeaders,
  withHeaders,
} from "../src/lib/security-headers.ts";

const expectedStaticHeaders = [
  "Strict-Transport-Security: max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options: nosniff",
  "X-Frame-Options: DENY",
  "Referrer-Policy: no-referrer",
  "Cross-Origin-Embedder-Policy: require-corp",
  "Cross-Origin-Opener-Policy: same-origin",
  "Cross-Origin-Resource-Policy: same-origin",
  "Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()",
];

describe("sha256Base64", () => {
  it("matches the CSP hash format", async ({ expect }) => {
    expect(await sha256Base64("abc")).toBe("ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=");
  });
});

describe("content security policy", () => {
  it("allows only own scripts and listed inline hashes", ({ expect }) => {
    const policy = contentSecurityPolicy({ scriptHashes: ["AAA=", "BBB="] });

    expect(policy).toBe(
      "default-src 'none'; script-src 'self' 'sha256-AAA=' 'sha256-BBB='; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none'",
    );
  });
});

describe("rendered _headers file", () => {
  it("is exactly the expected file", ({ expect }) => {
    const hash = createHash("sha256").update(bootScript).digest("base64");
    const headers = renderHeaders({ scriptHashes: [hash] });

    expect(headers).toBe(
      [
        "/*",
        `  Content-Security-Policy: ${contentSecurityPolicy({ scriptHashes: [hash] })}`,
        ...expectedStaticHeaders.map((header) => `  ${header}`),
        "",
        "/_astro/*",
        "  Cache-Control: public, max-age=31536000, immutable",
        "",
      ].join("\n"),
    );
  });
});

describe("headers for pages rendered on demand", () => {
  it("carry the same policy as the static pages", async ({ expect }) => {
    const hash = createHash("sha256").update(bootScript).digest("base64");

    expect(await sitePageHeaders()).toEqual(pageHeaders({ scriptHashes: [hash] }));
    expect((await sitePageHeaders()).map(([name, value]) => `${name}: ${value}`)).toEqual([
      `Content-Security-Policy: ${contentSecurityPolicy({ scriptHashes: [hash] })}`,
      ...expectedStaticHeaders,
    ]);
  });

  it("replace existing values and keep the response", async ({ expect }) => {
    const original = new Response("treść", {
      status: 404,
      headers: { "X-Frame-Options": "SAMEORIGIN", "Content-Type": "text/html" },
    });

    const secured = withHeaders(original, [
      ["X-Frame-Options", "DENY"],
      ["Cache-Control", "no-store"],
    ]);

    expect(secured.status).toBe(404);
    expect(Object.fromEntries(secured.headers)).toEqual({
      "cache-control": "no-store",
      "content-type": "text/html",
      "x-frame-options": "DENY",
    });
    expect(await secured.text()).toBe("treść");
  });
});
