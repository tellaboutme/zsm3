import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";
import { fakeQuestion, fakeQuestionsPanel } from "./panel-questions-fake.ts";
import { fakePanel, fakeRequest, pageProblems } from "./panel-requests-fake.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function fakeDrafts(page: Page, total: number | "fail"): Promise<void> {
  await page.route(
    (url) => url.pathname === "/api/panel/news",
    async (route) =>
      route.fulfill(
        total === "fail"
          ? { status: 500, contentType: "application/problem+json", body: "{}" }
          : {
              contentType: "application/json",
              body: JSON.stringify({ items: [], total, page: 1, pageSize: 1 }),
            },
      ),
  );
}

function waiting(page: Page): ReturnType<Page["locator"]> {
  return page.getByRole("region", { name: "Czeka na Ciebie" });
}

test.describe("panel overview", () => {
  test("shows the secretariat its new requests and drafts beside grouped sections", async ({
    page,
    problems,
    browserName,
  }) => {
    await fakePanel(
      page,
      "secretariat",
      [fakeRequest(1), fakeRequest(2), fakeRequest(3, { status: "ready" }), fakeRequest(4)],
      50,
    );
    await fakeDrafts(page, 2);
    await page.goto("/panel");

    await expect(page.getByRole("heading", { name: "Panel obsługi treści" })).toBeVisible();
    await expect(waiting(page).getByRole("link", { name: "3 Nowe wnioski" })).toHaveAttribute(
      "href",
      "/panel/wnioski",
    );
    await expect(waiting(page).getByRole("link", { name: "2 Szkice aktualności" })).toBeVisible();
    await expect(waiting(page).getByRole("link")).toHaveCount(2);
    const nav = page.getByRole("navigation", { name: "Wszystkie sekcje panelu" });
    await expect(nav.getByRole("heading", { name: "Treści strony" })).toBeVisible();
    await expect(nav.getByRole("heading", { name: "Uczniowie i rodzice" })).toBeVisible();
    await expect(nav.getByRole("heading", { name: "Administracja" })).toBeHidden();
    await expect(nav.getByRole("link", { name: /^Wnioski/u })).toBeVisible();
    expect(pageProblems(problems, browserName)).toEqual([]);
  });

  test("marks a full page of requests and survives a failed count", async ({ page }) => {
    await fakePanel(
      page,
      "admin",
      [1, 2, 3].map((id) => fakeRequest(id)),
      2,
    );
    await fakeDrafts(page, "fail");
    await page.goto("/panel");

    await expect(waiting(page).getByRole("link", { name: "2+ Nowe wnioski" })).toBeVisible();
    await expect(waiting(page).getByRole("link", { name: "— Szkice aktualności" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Wszystkie sekcje panelu" }).getByRole("heading", {
        name: "Administracja",
      }),
    ).toBeVisible();
  });

  test("lets the counsellor in to Skrzynka and its waiting questions", async ({ page }) => {
    await fakeQuestionsPanel(page, "counsellor", [
      fakeQuestion(1),
      fakeQuestion(2),
      fakeQuestion(3, { status: "published" }),
    ]);
    await page.goto("/panel");

    await expect(page.locator('[data-panel="app"]')).toBeVisible();
    await expect(
      waiting(page).getByRole("link", { name: "2 Pytania do odpowiedzi" }),
    ).toHaveAttribute("href", "/panel/skrzynka");
    const links = page
      .getByRole("navigation", { name: "Wszystkie sekcje panelu" })
      .getByRole("link");
    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute("href", "/panel/skrzynka");
  });

  test("hides the waiting list from the gallery editor", async ({ page }) => {
    await fakePanel(page, "gallery_editor", []);
    await page.goto("/panel");

    await expect(
      page
        .getByRole("navigation", { name: "Wszystkie sekcje panelu" })
        .getByRole("link", { name: /^Galeria/u }),
    ).toBeVisible();
    await expect(waiting(page)).toBeHidden();
  });

  for (const width of [360, 1280]) {
    test(`has no accessibility violations and fits ${String(width)} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await fakePanel(page, "admin", [fakeRequest(1)], 50);
      await fakeDrafts(page, 0);
      for (const colorScheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme });
        await page.goto("/panel");
        await expect(waiting(page).getByRole("link", { name: "1 Nowe wnioski" })).toBeVisible();
        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

        expect(results.violations, colorScheme).toEqual([]);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        ).toBeLessThanOrEqual(0);
      }
    });
  }
});
