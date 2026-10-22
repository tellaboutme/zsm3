import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const DESKTOP = { width: 1440, height: 900 } as const;

async function axeViolations(page: Page): Promise<unknown[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations;
}

test.describe("accessibility settings", () => {
  test.use({ viewport: DESKTOP });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/wzornik");
    await page.getByRole("button", { name: "Ustawienia dostępności" }).click();
  });

  test("apply at once and survive a reload", async ({ page, problems }) => {
    const dialog = page.getByRole("dialog", { name: "Ustawienia dostępności" });
    await dialog.getByLabel("Największy").check();
    await dialog.getByLabel("Wysoki kontrast").check();

    await expect(page.locator("html")).toHaveAttribute("data-text", "150");
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
    await dialog.getByRole("button", { name: "Gotowe" }).click();

    await expect(dialog).toBeHidden();
    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("data-text", "150");
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
    await page.getByRole("button", { name: "Ustawienia dostępności" }).click();

    await expect(dialog.getByLabel("Największy")).toBeChecked();
    expect(problems).toEqual([]);
  });

  test("reset to the defaults", async ({ page }) => {
    const dialog = page.getByRole("dialog", { name: "Ustawienia dostępności" });
    await dialog.getByLabel("Czytelny krój pisma").check();

    await expect(page.locator("html")).toHaveAttribute("data-font", "readable");
    await dialog.getByRole("button", { name: "Przywróć domyślne" }).click();

    await expect(page.locator("html")).not.toHaveAttribute("data-font");
    await expect(dialog.getByLabel("Standardowy")).toBeChecked();
    await page.reload();

    await expect(page.locator("html")).not.toHaveAttribute("data-font");
  });

  test("close on the backdrop", async ({ page }) => {
    const dialog = page.getByRole("dialog", { name: "Ustawienia dostępności" });
    await page.mouse.click(4, DESKTOP.height - 4);

    await expect(dialog).toBeHidden();
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`stay accessible in ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });

      await expect(page.getByRole("dialog", { name: "Ustawienia dostępności" })).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });
  }
});

test.describe("theme toggle", () => {
  test.use({ viewport: DESKTOP });

  test("cycles system, light and dark and remembers the choice", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/wzornik");
    const html = page.locator("html");

    await expect(html).not.toHaveAttribute("data-theme");
    await page.getByRole("button", { name: "Motyw: systemowy" }).click();

    await expect(html).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Motyw: jasny" }).click();

    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.reload();

    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Motyw: ciemny" }).click();

    await expect(html).not.toHaveAttribute("data-theme");
  });

  test("ignores tampered stored preferences", async ({ page, problems }) => {
    await page.addInitScript(() => {
      localStorage.setItem("zsm3.preferences", '{"theme":"<img>","text":"999"}');
    });
    await page.goto("/wzornik");

    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    await expect(page.locator("html")).not.toHaveAttribute("data-text");
    expect(problems).toEqual([]);
  });
});
