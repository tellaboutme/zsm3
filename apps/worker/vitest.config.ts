import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

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
          cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc", environment: "test" } }),
        ],
        test: {
          name: "workers",
          include: ["test/**/*.test.ts"],
        },
      },
    ],
  },
});
