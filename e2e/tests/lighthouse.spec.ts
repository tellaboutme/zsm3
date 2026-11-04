import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

import { expect, test } from "./fixtures.ts";

const PAGES = [
  { path: "/", port: 9223 },
  { path: "/szkola/galeria/2025-2026/przykladowy-album", port: 9224 },
] as const;
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

  for (const { path, port } of PAGES) {
    test(`${path} meets every budget`, async ({ baseURL }) => {
      const browser = await chromium.launch({
        args: [`--remote-debugging-port=${String(port)}`],
      });
      try {
        const result = await lighthouse(
          `${baseURL ?? ""}${path}`,
          { port, output: "json", logLevel: "error" },
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
  }
});
