import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const WIDTHS = [360, 390, 768, 1280, 1440, 1920] as const;
const FIELDS = [
  ["Informatyka", 2],
  ["Mechatronika i robotyka", 2],
  ["Motoryzacja", 5],
  ["Lotnictwo", 3],
  ["Porty i terminale", 1],
] as const;

function finder(page: Page): ReturnType<Page["locator"]> {
  return page.getByRole("region", { name: "Wybierz zawód" });
}

async function clippedNames(page: Page): Promise<readonly string[]> {
  return finder(page)
    .locator("h3, .name")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const box = (element.closest("a") ?? element.parentElement)?.getBoundingClientRect();
          return box === undefined || range.getBoundingClientRect().right > box.right + 0.5;
        })
        .map((element) => element.textContent.trim()),
    );
}

test.describe("profession index on the home page", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("lists every field with all of its professions visible", async ({ page }) => {
    await page.goto("/");

    await expect(finder(page).getByRole("heading", { level: 3 })).toHaveText(
      FIELDS.map(([name]) => name),
    );
    for (const [name, count] of FIELDS) {
      const group = finder(page).getByRole("region", { name, exact: true });
      await expect(group.getByRole("link").filter({ visible: true })).toHaveCount(count);
    }
  });

  test("links each profession with its codes and study paths", async ({ page }) => {
    await page.goto("/");
    const aviation = finder(page).getByRole("region", { name: "Lotnictwo", exact: true });
    const avionics = aviation.getByRole("link", { name: /^Technik awionik/u });

    await expect(avionics).toHaveAttribute("href", "/kandydaci/zawody/technik-awionik");
    await expect(avionics.getByText("TLO.01")).toBeVisible();
    await expect(avionics.getByText("Technikum · 5 lat")).toBeVisible();
  });

  test("reaches every profession from the keyboard", async ({ page }) => {
    await page.goto("/");
    await finder(page).getByRole("link", { name: "Wszystkie zawody" }).focus();
    await page.keyboard.press("Tab");

    await expect(page.getByRole("link", { name: /^Technik informatyk/u })).toBeFocused();
  });

  test("has no accessibility violations", async ({ page }) => {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/");
      const results = await new AxeBuilder({ page })
        .include("section[aria-labelledby=zawody]")
        .withTags(WCAG_TAGS)
        .analyze();

      expect(results.violations, colorScheme).toEqual([]);
    }
  });

  for (const width of WIDTHS) {
    test(`keeps field and profession names inside their boxes at ${String(width)} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      expect(await clippedNames(page)).toEqual([]);
    });
  }
});
