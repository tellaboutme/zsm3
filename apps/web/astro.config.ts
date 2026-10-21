import { defineConfig, envField } from "astro/config";

export default defineConfig({
  output: "static",
  trailingSlash: "never",
  compressHTML: true,
  devToolbar: { enabled: false },
  build: { inlineStylesheets: "never" },
  vite: { build: { assetsInlineLimit: 0 } },
  env: {
    schema: {
      PATTERN_LIBRARY: envField.boolean({ context: "server", access: "public", default: false }),
    },
  },
});
