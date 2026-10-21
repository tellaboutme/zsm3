import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function setRootAttribute(page: Page, name: string, value: string): Promise<void> {
  await page.evaluate(
    ([attribute, attributeValue]) => {
      document.documentElement.setAttribute(attribute, attributeValue);
    },
    [name, value] as const,
  );
}

async function computed(page: Page, selector: string, property: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
}

test.describe("pattern library", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no accessibility violations in ${colorScheme} theme`, async ({ page, problems }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const response = await page.goto("/wzornik");

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Fundament systemu wizualnego",
      );
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(results.violations).toEqual([]);
      expect(problems).toEqual([]);
    });
  }
});

test.describe("foundation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wzornik");
    await page.evaluate(async () => document.fonts.ready);
  });

  test("loads the brand typefaces", async ({ page }) => {
    const loaded = await page.evaluate(() => ({
      display: document.fonts.check('800 16px "Archivo Variable"'),
      body: document.fonts.check('400 16px "Source Sans 3 Variable"'),
    }));

    expect(loaded).toEqual({ display: true, body: true });
  });

  test("switches to the readable typeface", async ({ page }) => {
    expect(await computed(page, "body", "font-family")).toContain("Source Sans 3 Variable");
    await setRootAttribute(page, "data-font", "readable");

    expect(await computed(page, "body", "font-family")).toContain("Atkinson Hyperlegible Next");
  });

  test("scales text with the text-size setting", async ({ page }) => {
    await setRootAttribute(page, "data-text", "150");

    expect(await computed(page, "html", "font-size")).toBe("24px");
  });

  test("applies the high-contrast palette", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await setRootAttribute(page, "data-contrast", "high");

    expect(await computed(page, "body", "color")).toBe("rgb(0, 0, 0)");
  });

  test("follows an explicit dark theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await setRootAttribute(page, "data-theme", "dark");

    expect(await computed(page, "body", "background-color")).toBe("rgb(10, 15, 25)");
  });

  test("underlines links and greys out the page on request", async ({ page }) => {
    await setRootAttribute(page, "data-underline", "on");
    await setRootAttribute(page, "data-grayscale", "on");

    expect(await computed(page, ".nudge", "text-decoration-line")).toBe("underline");
    expect(await computed(page, "html", "filter")).toBe("grayscale(1)");
  });
});

test.describe("motion", () => {
  test("animates the page title by default", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/wzornik");

    expect(await computed(page, ".rise > span", "animation-name")).toBe("rise-in");
  });

  test("stops all motion when the system asks for less", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/wzornik");

    expect(await computed(page, ".rise > span", "animation-name")).toBe("none");
  });

  test("stops all motion when the setting asks for less", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/wzornik");
    await setRootAttribute(page, "data-motion", "reduce");

    expect(await computed(page, ".rise > span", "animation-name")).toBe("none");
  });
});
