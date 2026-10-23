import { AxeBuilder } from "@axe-core/playwright";

import { expect, test } from "./fixtures.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const DOCUMENTS = "/uczniowie/wzory-dokumentow";

test.describe("documents", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("lists every form with its size and date", async ({ page, problems }) => {
    await page.goto(DOCUMENTS);
    const rows = page.locator("[data-signer]");

    await expect(rows).toHaveCount(10);
    await expect(
      page.getByRole("link", { name: "Wniosek o wydanie duplikatu legitymacji" }),
    ).toHaveAttribute("href", /^\/media\/d\/[0-9a-f]{64}\.pdf$/u);
    await expect(rows.filter({ hasText: "W6" })).toContainText("PDF, 718 KB");
    expect(problems).toEqual([]);
  });

  test("filters forms by who submits them", async ({ page }) => {
    await page.goto(DOCUMENTS);
    const rows = page.locator("[data-signer]").filter({ visible: true });

    await page.getByRole("radio", { name: "Pełnoletni uczeń" }).check();

    await expect(rows).toHaveCount(5);
    await expect(
      page.getByRole("heading", { name: "Oświadczenia dla uczniów cudzoziemskich" }),
    ).toBeHidden();
    await expect(page.getByRole("status")).toHaveText("Pokazano formularze: 5");
    await page.getByRole("radio", { name: "Rodzic lub opiekun prawny" }).check();

    await expect(rows).toHaveCount(7);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no accessibility violations in ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      for (const path of [DOCUMENTS, "/szkola/kadra"]) {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

        expect(results.violations, path).toEqual([]);
      }
    });
  }
});

test.describe("documents without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still filter with the radio buttons", async ({ page }) => {
    await page.goto(DOCUMENTS);
    await page.getByRole("radio", { name: "Rodzic lub opiekun prawny" }).check();

    await expect(page.locator("[data-signer]").filter({ visible: true })).toHaveCount(7);
  });
});

test.describe("staff", () => {
  test("shows roles and subject areas without personal data", async ({ page, problems }) => {
    await page.goto("/szkola/kadra");

    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveCount(9);
    await expect(page.getByText("Kierownik szkolenia praktycznego")).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Przedmioty: Języki obce" }).getByRole("listitem"),
    ).toHaveText(["język angielski", "język niemiecki"]);
    expect(problems).toEqual([]);
  });

  test("never scroll sideways on a phone with the largest text", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem("zsm3.preferences", '{"text":"150"}');
    });
    for (const path of [DOCUMENTS, "/szkola/kadra"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflow, path).toBe(0);
    }
  });
});
