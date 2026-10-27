import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    setupFiles: ["test/setup.ts"],
    coverage: {
      provider: "istanbul",
      include: [
        "src/lib/**/*.ts",
        "worker/legacy-redirect.ts",
        "worker/legacy-route.ts",
        "worker/seo-response.ts",
      ],
      reporter: ["text", "lcov"],
      thresholds: { 100: true },
    },
  },
});
