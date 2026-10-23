import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const DESKTOP = { width: 1440, height: 900 } as const;
const PHONE = { width: 390, height: 844 } as const;

async function axeViolations(page: Page): Promise<unknown[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations;
}

function primaryNav(page: Page) {
  return page.getByRole("navigation", { name: "Główna", exact: true });
}

test.describe("desktop navigation", () => {
  test.use({ viewport: DESKTOP });
  test.skip(({ isMobile }) => isMobile, "The mega menu exists on wide screens only.");

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/wzornik");
  });

  test("keeps a single mega panel open at a time", async ({ page, problems }) => {
    const students = primaryNav(page).getByRole("button", { name: "Uczniowie" });
    const parents = primaryNav(page).getByRole("button", { name: "Rodzice" });

    await students.click();

    await expect(students).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#menu-uczniowie")).toBeVisible();
    await parents.click();

    await expect(students).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#menu-uczniowie")).toBeHidden();
    await expect(page.locator("#menu-rodzice")).toBeVisible();
    await parents.click();

    await expect(page.locator("#menu-rodzice")).toBeHidden();
    expect(problems).toEqual([]);
  });

  test("closes on Escape and returns focus to its button", async ({ page }) => {
    const students = primaryNav(page).getByRole("button", { name: "Uczniowie" });
    await students.focus();
    await page.keyboard.press("Enter");

    await expect(page.locator("#menu-uczniowie")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.locator("#menu-uczniowie")).toBeHidden();
    await expect(students).toBeFocused();
  });

  test("closes on a click outside", async ({ page }) => {
    await primaryNav(page).getByRole("button", { name: "Szkoła" }).click();

    await expect(page.locator("#menu-szkola")).toBeVisible();
    await page.mouse.click(DESKTOP.width / 2, DESKTOP.height - 8);

    await expect(page.locator("#menu-szkola")).toBeHidden();
  });

  test("closes when focus leaves the navigation", async ({ page }) => {
    await primaryNav(page).getByRole("button", { name: "Kandydaci" }).click();
    await page.getByRole("link", { name: "Szukaj" }).focus();

    await expect(page.locator("#menu-kandydaci")).toBeHidden();
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`an open mega panel stays accessible in ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await primaryNav(page).getByRole("button", { name: "Uczniowie" }).click();

      await expect(page.locator("#menu-uczniowie")).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });
  }
});

test.describe("phone navigation", () => {
  test.use({ viewport: PHONE });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/wzornik");
  });

  test("hides the desktop navigation behind the menu button", async ({ page }) => {
    await expect(primaryNav(page)).toBeHidden();
    await page.getByRole("button", { name: "Menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });

    await expect(menu).toBeVisible();
    await menu.getByText("Uczniowie", { exact: true }).click();

    await expect(menu.getByRole("link", { name: "Dzwonki" })).toBeVisible();
    await menu.getByRole("button", { name: "Zamknij menu" }).click();

    await expect(menu).toBeHidden();
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`the open menu stays accessible in ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.getByRole("button", { name: "Menu" }).click();

      await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });
  }

  test("never scrolls sideways, even with the largest text", async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-text", "150");
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(overflow).toBe(0);
  });
});

test.describe("page frame", () => {
  test("an important banner can be hidden for the session", async ({ page }) => {
    await page.goto("/wzornik");
    const banner = page.getByRole("complementary", { name: "Komunikat: Ważne" });

    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Ukryj komunikat" }).click();

    await expect(banner).toBeHidden();
    await page.reload();

    await expect(banner).toBeHidden();
  });

  test("the header shrinks on scroll without moving the page", async ({ page }) => {
    await page.goto("/kontakt");
    const header = page.locator("[data-site-header]");
    const heading = page.getByRole("heading", { level: 1 });
    const offset = async (): Promise<number> =>
      heading.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
    const before = await offset();

    await page.mouse.wheel(0, 120);

    await expect(header).toHaveAttribute("data-compact", "on");
    await expect.poll(async () => (await header.boundingBox())?.height ?? 0).toBeLessThan(64);
    expect(await offset()).toBeCloseTo(before, 0);
  });

  test("breadcrumbs mark the current page", async ({ page }) => {
    await page.goto("/wzornik");
    const crumbs = page.getByRole("navigation", { name: "Okruszki" });

    await expect(crumbs.getByRole("link", { name: "Strona główna" })).toHaveAttribute("href", "/");
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText("Wzornik");
  });

  test("the skip link jumps to the main content", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "Safari does not focus links with Tab by default.");
    await page.goto("/wzornik");
    await page.keyboard.press("Tab");

    await expect(page.getByRole("link", { name: "Przejdź do treści" })).toBeFocused();
  });

  test("the inline boot script matches the policy hash", async ({ page, request }) => {
    await page.goto("/");
    const script = await page.locator("head script:not([src])").first().textContent();
    const digest = await page.evaluate(async (text) => {
      const bytes = new TextEncoder().encode(text ?? "");
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      return btoa(String.fromCharCode(...new Uint8Array(hash)));
    }, script);
    const response = await request.get("/");

    expect(response.headers()["content-security-policy"]).toContain(
      `script-src 'self' 'sha256-${digest}';`,
    );
  });
});
