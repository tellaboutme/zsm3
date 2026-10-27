import cloudflare from "@astrojs/cloudflare";
import { defineConfig, envField } from "astro/config";

import { securityHeaders } from "./integrations/security-headers.ts";

export default defineConfig({
  output: "static",
  trailingSlash: "never",
  compressHTML: true,
  devToolbar: { enabled: false },
  adapter: cloudflare({ prerenderEnvironment: "node", imageService: "passthrough" }),
  session: false,
  integrations: [securityHeaders()],
  build: { inlineStylesheets: "never" },
  vite: { build: { assetsInlineLimit: 0 } },
  env: {
    schema: {
      PATTERN_LIBRARY: envField.boolean({ context: "server", access: "public", default: false }),
      REQUESTS_ENABLED: envField.boolean({ context: "server", access: "public", default: false }),
      TURNSTILE_SITE_KEY: envField.string({ context: "server", access: "public", default: "" }),
      REQUEST_NOTICE_URL: envField.string({ context: "server", access: "public", default: "" }),
      REQUEST_TERMS_URL: envField.string({ context: "server", access: "public", default: "" }),
      SHORT_LINK_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
