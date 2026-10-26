import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const migrations = await readD1Migrations("./migrations");

export default defineConfig({
  test: {
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.ts"],
      reporter: ["text", "lcov"],
      thresholds: { 100: true },
    },
    projects: [
      {
        test: {
          name: "node",
          include: ["test/**/*.test.ts"],
          exclude: ["test/**/*.workers.test.ts"],
          environment: "node",
        },
      },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: migrations,
                PII_KEY_PRIMARY: "test-pii-key-primary-0123456789abcdef",
                PII_KEY_SECONDARY: "test-pii-key-secondary-0123456789abcdef",
                EMAIL_INDEX_KEY: "test-email-index-key-0123456789abcdef",
                RATE_LIMIT_SALT: "test-rate-limit-salt-0123456789abcdef",
                TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
                TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
                BREVO_API_KEY: "test-brevo-api-key-0123456789abcdef",
                STATUS_EMAIL_FROM: "no-reply@zsm3.test",
                SECRETARIAT_EMAIL: "sekretariat@zsm3.test",
              },
            },
          }),
        ],
        test: {
          name: "workers",
          include: ["test/**/*.test.ts"],
          exclude: ["test/**/*.node.test.ts"],
        },
      },
    ],
  },
});
