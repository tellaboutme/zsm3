import { AxeBuilder } from "@axe-core/playwright";

import { expect, test } from "./fixtures.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const slugs = [
  "technik-informatyk",
  "technik-programista",
  "technik-robotyk",
  "technik-mechatronik",
  "technik-pojazdow-samochodowych",
  "technik-elektromobilnosci",
  "technik-pojazdow-samochodowych-branzowa-ii",
  "technik-elektromobilnosci-branzowa-ii",
  "mechanik-pojazdow-samochodowych",
  "elektromechanik-pojazdow-samochodowych",
  "mechanik-motocyklowy",
  "technik-awionik",
  "technik-mechanik-lotniczy",
  "technik-lotniskowych-sluzb-operacyjnych",
  "technik-eksploatacji-portow-i-terminali",
];

test.describe("professions listing", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("filters by field and school", async ({ page, problems }) => {
    await page.goto("/kandydaci/zawody");
    const tiles = page.locator(".tiles > li");

    await expect(tiles.filter({ visible: true })).toHaveCount(15);
    await page.getByRole("radio", { name: "Motoryzacja" }).check();

    await expect(tiles.filter({ visible: true })).toHaveCount(7);
    await page.getByRole("radio", { name: "Branżowa II stopnia" }).check();

    await expect(tiles.filter({ visible: true })).toHaveCount(2);
    await expect(page.getByRole("status")).toHaveText("Pokazano kierunki: 2 z 15");
    await page.getByRole("radio", { name: "Lotnictwo" }).check();

    await expect(tiles.filter({ visible: true })).toHaveCount(0);
    await expect(
      page.getByText("Ta szkoła nie prowadzi kierunków w wybranej branży."),
    ).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("selects the field named in the address", async ({ page }) => {
    await page.goto("/kandydaci/zawody#lotnictwo");

    await expect(page.getByRole("radio", { name: "Lotnictwo" })).toBeChecked();
    await expect(page.locator(".tiles > li").filter({ visible: true })).toHaveCount(3);
  });

  test("compares all programmes in a table", async ({ page }) => {
    await page.goto("/kandydaci/zawody");
    await page.getByText("Porównaj wszystkie kierunki w tabeli").click();
    const table = page.getByRole("table");

    await expect(table.getByRole("row")).toHaveCount(16);
    await expect(
      table.getByRole("row", { name: /Technik pojazdów samochodowych.*Technikum/u }),
    ).toContainText("MOT.05 / MOT.02 + MOT.06");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no accessibility violations in ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/kandydaci/zawody");
      await page.getByText("Porównaj wszystkie kierunki w tabeli").click();
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(results.violations).toEqual([]);
    });
  }
});

test.describe("professions listing without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still filters with the radio buttons", async ({ page }) => {
    await page.goto("/kandydaci/zawody");
    await page.getByRole("radio", { name: "Informatyka" }).check();

    await expect(page.locator(".tiles > li").filter({ visible: true })).toHaveCount(2);
  });
});

test.describe("programme pages", () => {
  test("all fifteen render without errors", async ({ page, problems }) => {
    for (const slug of slugs) {
      const response = await page.goto(`/kandydaci/zawody/${slug}`);

      expect(response?.status(), slug).toBe(200);
      await expect(page.getByRole("heading", { level: 1 }), slug).toBeVisible();
      await expect(page.getByRole("heading", { name: "Czego się uczysz" }), slug).toBeVisible();
    }
    expect(problems).toEqual([]);
  });

  test("answers questions and links to recruitment", async ({ page }) => {
    await page.goto("/kandydaci/zawody/mechanik-motocyklowy");
    await page.getByText("Czy w trakcie nauki zrobię prawo jazdy?").click();

    await expect(page.getByText("bezpłatnego kursu prawa jazdy kategorii A")).toBeVisible();
    await expect(
      page
        .getByRole("complementary", { name: "W skrócie" })
        .getByRole("link", { name: /Rekrutacja/u }),
    ).toHaveAttribute("href", "/kandydaci/rekrutacja");
  });

  for (const slug of [
    "technik-programista",
    "mechanik-motocyklowy",
    "technik-elektromobilnosci-branzowa-ii",
  ]) {
    for (const colorScheme of ["light", "dark"] as const) {
      test(`${slug} has no accessibility violations in ${colorScheme} theme`, async ({ page }) => {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto(`/kandydaci/zawody/${slug}`);
        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

        expect(results.violations).toEqual([]);
      });
    }
  }

  test("never scrolls sideways on a phone with the largest text", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem("zsm3.preferences", '{"text":"150"}');
    });
    for (const slug of [
      "technik-lotniskowych-sluzb-operacyjnych",
      "elektromechanik-pojazdow-samochodowych",
    ]) {
      await page.goto(`/kandydaci/zawody/${slug}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflow, slug).toBe(0);
    }
  });

  test("fact strips stay within the viewport across programmes and themes", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/kandydaci/zawody");
    const paths = await page
      .locator('a[href^="/kandydaci/zawody/"]')
      .evaluateAll((links) =>
        [
          ...new Set(links.map((link) => (link instanceof HTMLAnchorElement ? link.pathname : ""))),
        ].filter((path) => path.startsWith("/kandydaci/zawody/")),
      );
    expect(paths.length).toBeGreaterThan(0);

    for (const width of [360, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const colorScheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        for (const path of width === 360 || width === 1920
          ? ["/kandydaci/zawody/technik-mechatronik"]
          : paths) {
          await page.goto(path);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          expect(overflow, `${path} at ${String(width)}px in ${colorScheme}`).toBe(0);
        }
      }
    }
  });
});
