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

function field(page: Page, name: string): ReturnType<Page["locator"]> {
  return finder(page)
    .locator("details")
    .filter({ has: page.locator(".field").getByText(name, { exact: true }) });
}

async function clippedHeadings(page: Page): Promise<readonly string[]> {
  return finder(page)
    .locator(".field, .name")
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.getClientRects().length > 0)
        .filter((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const limit = element.classList.contains("field")
            ? element.closest("summary")?.querySelector(".count")?.getBoundingClientRect().left
            : element.closest("a")?.getBoundingClientRect().right;
          return limit === undefined || range.getBoundingClientRect().right > limit;
        })
        .map((element) => element.textContent.trim()),
    );
}

test.describe("profession index on the home page", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("lists every field closed, with the number of professions", async ({ page }) => {
    await page.goto("/");
    const fields = finder(page).locator("details");

    await expect(fields).toHaveCount(FIELDS.length);
    for (const [name, count] of FIELDS) {
      const item = field(page, name);
      await expect(item).not.toHaveAttribute("open");
      await expect(item.locator("summary")).toContainText(`zawody: ${String(count)}`);
      await expect(item.locator("a")).toHaveCount(count);
    }
  });

  test("opens one field at a time and links each profession", async ({ page }) => {
    await page.goto("/");
    await field(page, "Lotnictwo").locator("summary").click();
    const aviation = field(page, "Lotnictwo");

    await expect(aviation).toHaveAttribute("open");
    await expect(aviation.getByRole("link", { name: /^Technik awionik/u })).toHaveAttribute(
      "href",
      "/kandydaci/zawody/technik-awionik",
    );
    await expect(aviation.getByText("TLO.01")).toBeVisible();

    await field(page, "Motoryzacja").locator("summary").click();

    await expect(field(page, "Motoryzacja")).toHaveAttribute("open");
    await expect(aviation).not.toHaveAttribute("open");
    await expect(
      field(page, "Motoryzacja").getByRole("link").filter({ visible: true }),
    ).toHaveCount(5);
  });

  test("opens a field from the keyboard", async ({ page }) => {
    await page.goto("/");
    const summary = field(page, "Informatyka").locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");

    await expect(field(page, "Informatyka")).toHaveAttribute("open");
    await page.keyboard.press("Tab");

    await expect(page.getByRole("link", { name: /^Technik informatyk/u })).toBeFocused();
  });

  test("has no accessibility violations with a field open", async ({ page }) => {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/");
      await field(page, "Motoryzacja").locator("summary").click();
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
      for (const [name] of FIELDS) {
        await field(page, name).locator("summary").click();

        expect(await clippedHeadings(page), name).toEqual([]);
      }
    });
  }
});

test.describe("profession index without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still opens a field and shows its professions", async ({ page }) => {
    await page.goto("/");
    await field(page, "Porty i terminale").locator("summary").click();

    await expect(
      page.getByRole("link", { name: /^Technik eksploatacji portów i terminali/u }),
    ).toBeVisible();
  });
});
