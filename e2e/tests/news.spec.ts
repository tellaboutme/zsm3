import { AxeBuilder } from "@axe-core/playwright";

import { expect, test } from "./fixtures.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const SCHEDULE = "/aktualnosci/2026/dzien-patrona-szkoly-i-slubowanie-klas-pierwszych";

test.describe("news listing", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("pages through the news with numbered pagination", async ({ page, problems }) => {
    await page.goto("/aktualnosci");
    const pagination = page.getByRole("navigation", { name: "Strony" });
    const headings = page.getByRole("main").getByRole("heading", { level: 2 });

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aktualności");
    await expect(headings).toHaveCount(9);
    await expect(pagination.getByRole("link", { name: "Strona 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await pagination.getByRole("link", { name: /Starsze/u }).click();

    await expect(page).toHaveURL(/\/aktualnosci\/strona\/2$/u);
    await expect(headings).toHaveCount(2);
    await expect(pagination.getByRole("link", { name: "Strona 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await pagination.getByRole("link", { name: /Nowsze/u }).click();

    await expect(page).toHaveURL(/\/aktualnosci$/u);
    expect(problems).toEqual([]);
  });

  test("filters by category and by year", async ({ page }) => {
    await page.goto("/aktualnosci");
    await page
      .getByRole("navigation", { name: "Kategorie" })
      .getByRole("link", { name: "Sport" })
      .click();

    await expect(page).toHaveURL(/\/aktualnosci\/kategoria\/sport$/u);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sport");
    await expect(
      page.getByRole("navigation", { name: "Kategorie" }).getByRole("link", { name: "Sport" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "Strony" })).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "Lata" })
      .getByRole("link", { name: "2026" })
      .click();

    await expect(page).toHaveURL(/\/aktualnosci\/2026$/u);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aktualności 2026");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no accessibility violations in ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/aktualnosci");
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(results.violations).toEqual([]);
    });
  }
});

test.describe("news article", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("renders the structured body", async ({ page, problems }) => {
    await page.goto(SCHEDULE);
    const table = page.getByRole("table", { name: "Harmonogram 23 października 2026" });

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Dzień Patrona Szkoły i ślubowanie klas pierwszych",
    );
    await expect(table.getByRole("columnheader")).toHaveText(["Godzina", "Punkt programu"]);
    await expect(table.getByRole("row")).toHaveCount(6);
    await expect(page.getByRole("link", { name: "terminarz roku szkolnego" })).toHaveAttribute(
      "href",
      "/szkola/terminarz",
    );
    await expect(page.locator("main script")).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test("links to neighbouring and related news", async ({ page }) => {
    await page.goto("/aktualnosci/2026/konkurs-bogdan-wlosik-i-jego-nowohucka-mala-ojczyzna");
    const neighbours = page.getByRole("navigation", { name: "Sąsiednie artykuły" });

    await expect(
      neighbours.getByRole("link", { name: /Warsztaty pierwszej pomocy/u }),
    ).toHaveAttribute("rel", "prev");
    await expect(neighbours.getByRole("link", { name: /Wdzięczni Weteranom/u })).toHaveAttribute(
      "rel",
      "next",
    );
    await expect(
      page.getByRole("region", { name: "Przeczytaj też" }).getByRole("article"),
    ).toHaveCount(3);
  });

  test("copies its link", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Only Chromium lets tests grant clipboard access.");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(SCHEDULE);
    await page.getByRole("button", { name: "Kopiuj link do artykułu" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Link" })).toHaveText(
      "Link skopiowany do schowka.",
    );
    expect(await page.evaluate(async () => navigator.clipboard.readText())).toBe(page.url());
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no accessibility violations in ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(SCHEDULE);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(results.violations).toEqual([]);
    });
  }

  test("never scrolls sideways on a phone with the largest text", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem("zsm3.preferences", '{"text":"150"}');
    });
    for (const path of [SCHEDULE, "/aktualnosci"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflow, path).toBe(0);
    }
  });
});

test.describe("video facade", () => {
  test("links to YouTube without embedding it", async ({ page }) => {
    await page.goto("/wzornik");

    await expect(page.getByRole("link", { name: /Obejrzyj na YouTube/u })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=1zR5BuBQZcI",
    );
    await expect(page.locator("iframe")).toHaveCount(0);
  });
});
