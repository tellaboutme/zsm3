import { describe, it } from "vitest";

import { send } from "./support.ts";

const expectedHeaders = {
  "Content-Security-Policy":
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cache-Control": "no-store",
} as const;

describe("API security headers", () => {
  it.for(["/api/health", "/api/unknown"])("are set on %s", async (path, { expect }) => {
    const response = await send(path);

    for (const [name, value] of Object.entries(expectedHeaders)) {
      expect(response.headers.get(name), name).toBe(value);
    }
  });
});
