import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

const MAX_SHIFT = 0.005;
const SETTLE_MS = 500;
const WIDTHS = [390, 768, 1024, 1350] as const;
const MOMENTS = [
  ["before lessons", "Przed lekcjami", new Date("2026-10-21T22:20:00Z")],
  ["a lesson", "1. lekcja", new Date("2026-10-22T05:40:00Z")],
  ["after lessons", "Teraz nie ma lekcji", new Date("2026-10-22T20:30:00Z")],
  ["a weekend", "Teraz nie ma lekcji", new Date("2026-10-24T10:00:00Z")],
] as const;

async function layoutShift(page: Page): Promise<number> {
  return page.evaluate(
    async (settle) =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const recent = "hadRecentInput" in entry && entry.hadRecentInput === true;
            if (!recent && "value" in entry && typeof entry.value === "number") {
              total += entry.value;
            }
          }
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          resolve(total);
        }, settle);
      }),
    SETTLE_MS,
  );
}

test.describe("live status card", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Layout shift entries are reported by Chromium only.",
  );

  for (const [moment, title, time] of MOMENTS) {
    for (const width of WIDTHS) {
      test(`keeps its size during ${moment} at ${String(width)} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 940 });
        await page.clock.setFixedTime(time);
        await page.goto("/");
        await expect(page.locator("main [data-live=title]").first()).toHaveText(title);
        expect(await layoutShift(page)).toBeLessThanOrEqual(MAX_SHIFT);
      });
    }
  }
});
