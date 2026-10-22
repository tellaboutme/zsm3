import { createHash } from "node:crypto";

import { describe, it } from "vitest";

import { bootScript } from "../src/lib/preferences.ts";
import { contentSecurityPolicy, renderHeaders, sha256Base64 } from "../src/lib/security-headers.ts";

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
  it("matches the CSP hash format", ({ expect }) => {
    expect(sha256Base64("abc")).toBe("ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=");
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
