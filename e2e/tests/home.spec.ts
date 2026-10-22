import { AxeBuilder } from "@axe-core/playwright";

import { expect, test } from "./fixtures.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

test.describe("home page", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no accessibility violations in ${colorScheme} theme`, async ({ page, problems }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/");

      await expect(page.getByRole("region", { name: "Teraz w szkole" })).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(results.violations).toEqual([]);
      expect(problems).toEqual([]);
    });
  }

  test("filters professions by field", async ({ page }) => {
    await page.goto("/");
    const filter = page.getByRole("group", { name: "Branża" });
    const tiles = page.locator(".tiles > li");

    await expect(tiles).toHaveCount(13);
    await filter.getByRole("button", { name: /^Lotnictwo/u }).click();

    await expect(filter.getByRole("button", { name: /^Lotnictwo/u })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(tiles.filter({ visible: true })).toHaveCount(3);
    await expect(page.getByRole("status")).toHaveText("Pokazano zawody: 3 z 13");
    await filter.getByRole("button", { name: /^Wszystkie/u }).click();

    await expect(tiles.filter({ visible: true })).toHaveCount(13);
    await expect(filter.getByRole("button", { name: /^Lotnictwo/u })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("shows at most five upcoming events", async ({ page }) => {
    await page.goto("/");
    const events = page.locator("[data-event]");
    const visible = await events.filter({ visible: true }).count();

    expect(visible).toBeLessThanOrEqual(5);
    await expect(page.locator("[data-no-events]")).toBeVisible({ visible: visible === 0 });
  });

  test("hides events once they have passed", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2035-01-01T12:00:00Z"));
    await page.goto("/");

    await expect(page.locator("[data-event]").filter({ visible: true })).toHaveCount(0);
    await expect(page.getByText("Nie ma zaplanowanych wydarzeń.")).toBeVisible();
  });

  test("never scrolls sideways on a phone with the largest text", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem("zsm3.preferences", '{"text":"150"}');
    });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(overflow).toBe(0);
  });
});
