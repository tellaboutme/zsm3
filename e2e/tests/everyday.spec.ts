import { AxeBuilder } from "@axe-core/playwright";

import { expect, test } from "./fixtures.ts";

const LONGEST_TIMER = new Date("2026-10-22T01:30:00Z");

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const PAGES = [
  "/kandydaci",
  "/uczniowie",
  "/rodzice",
  "/szkola",
  "/szkola/historia",
  "/szkola/patron",
  "/uczniowie/dzwonki",
  "/szkola/terminarz",
  "/rodzice/wywiadowki",
  "/kontakt",
];

test.describe("everyday templates", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("every page renders without errors", async ({ page, problems }) => {
    for (const path of PAGES) {
      const response = await page.goto(path);

      expect(response?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1 }), path).toBeVisible();
    }
    expect(problems).toEqual([]);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`pages have no accessibility violations in ${colorScheme} theme`, async ({ page }) => {
      test.slow();
      await page.emulateMedia({ colorScheme });
      for (const path of PAGES) {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

        expect(results.violations, path).toEqual([]);
      }
    });
  }

  test("a hub leads to its tasks", async ({ page }) => {
    await page.goto("/rodzice");

    await expect(page.getByRole("link", { name: /Wywiadówki/u }).first()).toHaveAttribute(
      "href",
      "/rodzice/wywiadowki",
    );
    await expect(page.getByRole("heading", { name: "Spotkania" })).toBeVisible();
  });

  test("a long content page offers in-page navigation and siblings", async ({ page }) => {
    await page.goto("/szkola/historia");
    const inPage = page.getByRole("navigation", { name: "Na tej stronie" });

    await expect(inPage.getByRole("link")).toHaveCount(4);
    await inPage.getByRole("link", { name: "Kalendarium" }).click();

    await expect(page).toHaveURL(/#kalendarium$/u);
    await expect(page.locator("#kalendarium li")).toHaveCount(9);
    await expect(
      page.getByRole("navigation", { name: "Zobacz też" }).getByRole("link", { name: /Patron/u }),
    ).toHaveAttribute("href", "/szkola/patron");
  });
});

test.describe("bell schedule", () => {
  test("lists the regular plan with breaks", async ({ page }) => {
    await page.goto("/uczniowie/dzwonki");
    const table = page.getByRole("table", { name: "Zwykły plan lekcji" });

    await expect(table.locator("tbody tr")).toHaveCount(14);
    await expect(table.locator("tbody tr").nth(4)).toContainText("20 min");
  });

  test("switches to the shortened plan on its day", async ({ page }) => {
    await page.goto("/uczniowie/dzwonki");
    const variants = page.locator("[data-variant]");

    await expect(variants.filter({ visible: true })).toHaveCount(2);
    await expect(page.getByText("Nie ma zaplanowanych dni ze skróconymi lekcjami.")).toBeHidden();
    const day = await variants.first().getAttribute("data-date");
    await page.clock.setFixedTime(new Date(`${String(day)}T08:00:00Z`));
    await page.reload();

    await expect(page.locator("[data-today-label]")).toHaveText("Lekcje skrócone od 9. lekcji");
    await expect(page.locator("[data-live-status]").first()).not.toHaveAttribute("data-state", "");
  });
});

test.describe("school calendar", () => {
  test("filters by audience and kind", async ({ page }) => {
    await page.goto("/szkola/terminarz");
    const events = page.locator(".event").filter({ visible: true });

    await expect(events).toHaveCount(28);
    await page.getByRole("radio", { name: "Rodzice" }).check();

    await expect(events).toHaveCount(14);
    await page.getByRole("radio", { name: "Egzaminy" }).check();

    await expect(events).toHaveCount(0);
    await expect(page.getByText("Brak terminów dla wybranych filtrów.")).toBeVisible();
  });

  test("exports the calendar as iCalendar", async ({ request }) => {
    const response = await request.get("/szkola/terminarz.ics");
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/calendar");
    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body.match(/BEGIN:VEVENT/gu)).toHaveLength(28);
  });
});

test.describe("school calendar without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still filters with the radio buttons", async ({ page }) => {
    await page.goto("/szkola/terminarz");
    await page.getByRole("radio", { name: "Zebrania z rodzicami" }).check();

    await expect(page.locator(".event").filter({ visible: true })).toHaveCount(4);
  });
});

test.describe("meetings and contact", () => {
  test("lists the room of every class", async ({ page }) => {
    await page.goto("/rodzice/wywiadowki");

    await expect(page.getByRole("table")).toHaveCount(5);
    await expect(page.locator("tbody tr")).toHaveCount(33);
    await expect(page.getByRole("row", { name: "1 Ta/d 118" })).toBeVisible();
  });

  test("links phones and e-mail addresses", async ({ page }) => {
    await page.goto("/kontakt");

    await expect(page.getByRole("link", { name: "12 644 06 89 wew. 103" })).toHaveAttribute(
      "href",
      "tel:+48126440689,103",
    );
    await expect(
      page.getByRole("link", { name: "u@zespolszkolmechanicznych.edu.pl" }),
    ).toHaveAttribute("href", "mailto:u@zespolszkolmechanicznych.edu.pl");
  });

  test("never scroll sideways on a phone with the largest text", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.clock.setFixedTime(LONGEST_TIMER);
    await page.addInitScript(() => {
      localStorage.setItem("zsm3.preferences", '{"text":"150"}');
    });
    for (const path of PAGES) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflow, path).toBe(0);
    }
  });
});
