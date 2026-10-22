import { writeFile } from "node:fs/promises";

import type { AstroIntegration } from "astro";

import { bootScript } from "../src/lib/preferences.ts";
import { renderHeaders, sha256Base64 } from "../src/lib/security-headers.ts";

export function securityHeaders(): AstroIntegration {
  return {
    name: "zsm3-security-headers",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const headers = renderHeaders({ scriptHashes: [sha256Base64(bootScript)] });
        await writeFile(new URL("_headers", dir), headers, "utf8");
      },
    },
  };
}
