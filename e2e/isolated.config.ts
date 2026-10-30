import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "isolated",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: [["list"]],
  timeout: 120_000,
});
