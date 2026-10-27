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
          testTimeout: 30_000,
        },
      },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: migrations,
                PII_KEY_PRIMARY: `test-${"p".repeat(32)}`,
                PII_KEY_SECONDARY: `test-${"s".repeat(32)}`,
                EMAIL_INDEX_KEY: "test-email-index-key-0123456789abcdef",
                RATE_LIMIT_SALT: "test-rate-limit-salt-0123456789abcdef",
                TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
                TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
                BREVO_API_KEY: `test-${"brevo".repeat(6)}`,
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
