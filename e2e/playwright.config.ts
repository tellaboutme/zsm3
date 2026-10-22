import { defineConfig, devices } from "@playwright/test";

const PORT = 8787;
const BASE_URL = `http://127.0.0.1:${String(PORT)}`;
const IN_CI = process.env["CI"] === "true";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: IN_CI,
  retries: 0,
  reporter: IN_CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  snapshotPathTemplate: "{testDir}/baselines/{arg}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.001 } },
  projects: [
    {
      name: "visual",
      testDir: "visual",
      testMatch: "*.visual.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm --filter @zsm3/worker dev",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !IN_CI,
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: "false" },
  },
});
