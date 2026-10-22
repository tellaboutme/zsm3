import { AxeBuilder } from "@axe-core/playwright";

import { expect, test } from "./fixtures.ts";

const pages = [
  { path: "/", status: 200, heading: "Zespół Szkół Mechanicznych nr 3 w Krakowie" },
  { path: "/nie-istnieje", status: 404, heading: "Nie znaleziono strony" },
] as const;

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

for (const { path, status, heading } of pages) {
  test.describe(path, () => {
    test("renders without errors or policy violations", async ({ page, problems }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(status);
      await expect(page.locator("html")).toHaveAttribute("lang", "pl");
      await expect(page).toHaveTitle(/\S/u);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      await expect(page.getByRole("main")).toBeVisible();
      expect(problems).toEqual([]);
    });

    test("has no accessibility violations", async ({ page }) => {
      await page.goto(path);

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(results.violations).toEqual([]);
    });
  });
}
