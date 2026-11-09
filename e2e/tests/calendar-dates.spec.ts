import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

const BEFORE_SCHOOL_YEAR = new Date("2026-09-01T08:00:00Z");
const WIDTHS = [360, 390, 768, 1440] as const;

interface EndpointLayout {
  readonly text: string;
  readonly lines: number;
  readonly dashAlone: boolean;
}

async function endpointLayouts(page: Page, scope: string): Promise<readonly EndpointLayout[]> {
  return page.locator(`${scope} [data-date-endpoint]`).evaluateAll((endpoints) =>
    endpoints
      .filter((endpoint) => endpoint.getClientRects().length > 0)
      .map((endpoint) => {
        const range = document.createRange();
        range.selectNodeContents(endpoint);
        const tops = [...range.getClientRects()].map((rect) => Math.round(rect.top));
        const text = endpoint.textContent;
        return {
          text,
          lines: new Set(tops).size,
          dashAlone: text.trim() === "–",
        };
      }),
  );
}

async function top(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => element.getBoundingClientRect().top);
}

async function bottom(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => element.getBoundingClientRect().bottom);
}

async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

for (const width of WIDTHS) {
  test(`date ranges keep each full date together at ${String(width)} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, scope] of [
      ["/", "section[aria-labelledby=co-przed-nami]"],
      ["/szkola/terminarz", "main"],
    ] as const) {
      await page.clock.setFixedTime(BEFORE_SCHOOL_YEAR);
      await page.goto(path);
      const layouts = await endpointLayouts(page, scope);
      expect(layouts.length, path).toBeGreaterThan(1);
      for (const layout of layouts) {
        expect(layout.lines, `${path}: ${layout.text}`).toBe(1);
        expect(layout.dashAlone).toBe(false);
      }
      expect(await pageOverflow(page)).toBe(0);
    }
  });
}

test("a range keeps its dash with the first date and both dates machine-readable", async ({
  page,
}) => {
  await page.clock.setFixedTime(BEFORE_SCHOOL_YEAR);
  await page.goto("/");
  const event = page.locator("[data-event]", { hasText: "Praktyki zawodowe klas czwartych" });
  await expect(event.locator("time")).toHaveText(["7 września 2026", "2 października 2026"]);
  await expect(event.locator("time").first()).toHaveAttribute("datetime", "2026-09-07");
  await expect(event.locator("time").last()).toHaveAttribute("datetime", "2026-10-02");
  await expect(event.locator("[data-date-endpoint]").first()).toHaveText("7 września 2026 –");
});

test("the date plaque is decorative and compact", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(BEFORE_SCHOOL_YEAR);
  await page.goto("/");
  const plaques = page.locator("[data-event]:not([hidden]) .plaque");
  await expect(plaques.first()).toHaveAttribute("aria-hidden", "true");
  const practice = page.locator("[data-event]", { hasText: "Praktyki zawodowe klas czwartych" });
  await expect(practice.locator(".plaque")).toHaveText(/7\s*wrz/iu);
  for (const plaque of await plaques.all()) {
    const box = await plaque.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(56);
    expect(box?.width ?? 0).toBeLessThanOrEqual(72);
  }
});

test("at 200% text on a phone the plaque moves above the text and nothing overflows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.clock.setFixedTime(BEFORE_SCHOOL_YEAR);
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const event = "[data-event]:not([hidden])";
  expect(await bottom(page, `${event} .plaque`)).toBeLessThanOrEqual(
    (await top(page, `${event} .when`)) + 1,
  );
  expect(await pageOverflow(page)).toBe(0);
  const live = "main [data-live-status]";
  expect(await bottom(page, `${live} .status`)).toBeLessThanOrEqual(
    (await top(page, `${live} [data-live=timer]`)) + 1,
  );
});
