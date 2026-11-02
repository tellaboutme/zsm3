import { AxeBuilder } from "@axe-core/playwright";

import { expect, test } from "./fixtures.ts";
import { fakePanel, fakeRequest } from "./panel-requests-fake.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

test.describe("staff requests accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await fakePanel(page, "secretariat", [
      fakeRequest(3, { status: "ready" }),
      fakeRequest(2, { status: "in_progress" }),
      fakeRequest(1, { firstName: null, lastName: null, email: null }),
    ]);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no violations with a confirmation open in ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/panel/wnioski");
      await page.getByRole("button", { name: `Szczegóły wniosku nr ${fakeRequest(3).id}` }).click();
      await page.getByRole("button", { name: "Odrzuć wniosek" }).click();
      await expect(page.locator('[data-panel="request-confirm"]')).toBeVisible();

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("has no violations with unreadable personal data", async ({ page }) => {
    await page.goto("/panel/wnioski");
    await page.getByRole("button", { name: "Pokaż starsze" }).click();
    await page.getByRole("button", { name: `Szczegóły wniosku nr ${fakeRequest(1).id}` }).click();
    await expect(page.locator('[data-panel="request-pii"]')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test("opens a request from the keyboard alone", async ({ page }) => {
    await page.goto("/panel/wnioski");
    const open = page.getByRole("button", { name: `Szczegóły wniosku nr ${fakeRequest(2).id}` });
    await expect(open).toBeVisible();
    await open.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-panel="request-title"]')).toBeFocused();
    await expect(page.locator('[data-panel="request-rows"] li[aria-current="true"]')).toHaveCount(
      1,
    );
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Oznacz jako gotowy do odbioru" })).toBeFocused();
  });

  test("keeps an open confirmation inside a phone screen at 200% text", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/panel/wnioski");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await page.getByRole("button", { name: `Szczegóły wniosku nr ${fakeRequest(3).id}` }).click();
    await page.getByRole("button", { name: "Odrzuć wniosek" }).click();
    await expect(page.getByRole("button", { name: "Tak, odrzuć wniosek" })).toBeVisible();
    const size = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(size.scroll).toBe(size.client);
  });

  test("fits phone, tablet and desktop widths", async ({ page }) => {
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/panel/wnioski");
      await page.getByRole("button", { name: `Szczegóły wniosku nr ${fakeRequest(3).id}` }).click();
      await expect(page.locator('[data-panel="request-facts"]')).toContainText("Anna Nowak");
      const size = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(size.scroll).toBe(size.client);
    }
  });
});
