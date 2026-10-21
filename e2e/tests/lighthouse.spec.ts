import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

import { expect, test } from "./fixtures.ts";

const DEBUGGING_PORT = 9223;
const MAX_LAYOUT_SHIFT = 0.02;

const minimumScores = {
  performance: 0.95,
  accessibility: 1,
  "best-practices": 1,
} as const;

test.describe("lighthouse budgets", () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== "chromium" || isMobile,
    "Lighthouse audits through the Chromium DevTools protocol only.",
  );

  test("the home page meets every budget", async ({ baseURL }) => {
    const browser = await chromium.launch({
      args: [`--remote-debugging-port=${String(DEBUGGING_PORT)}`],
    });
    try {
      const result = await lighthouse(
        `${baseURL ?? ""}/`,
        { port: DEBUGGING_PORT, output: "json", logLevel: "error" },
        desktopConfig,
      );
      const report = result?.lhr;

      expect(report?.runtimeError).toBeUndefined();
      for (const [category, minimum] of Object.entries(minimumScores)) {
        expect(report?.categories[category]?.score, category).toBeGreaterThanOrEqual(minimum);
      }
      expect(report?.audits["cumulative-layout-shift"]?.numericValue).toBeLessThanOrEqual(
        MAX_LAYOUT_SHIFT,
      );
    } finally {
      await browser.close();
    }
  });
});
