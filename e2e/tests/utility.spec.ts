import { AxeBuilder } from "@axe-core/playwright";
import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const LINK = /href="(\/[^"#?]*)/gu;

function internalLinks(html: string): readonly string[] {
  return [...html.matchAll(LINK)].flatMap((match) =>
    match[1] === undefined || /\.[a-z]+$/u.test(match[1]) ? [] : [match[1]],
  );
}

async function crawl(request: APIRequestContext): Promise<ReadonlySet<string>> {
  const pages = new Set<string>();
  const queue = ["/"];
  const seen = new Set(queue);
  while (queue.length > 0) {
    const path = queue.shift() ?? "/";
    const response = await request.get(path);
    if (!response.ok() || !(response.headers()["content-type"] ?? "").includes("text/html")) {
      continue;
    }
    pages.add(path);
    const fresh = internalLinks(await response.text()).filter((link) => !seen.has(link));
    for (const link of fresh) {
      seen.add(link);
      queue.push(link);
    }
  }
  return pages;
}

test.describe("site map", () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== "chromium" || isMobile,
    "One crawl is enough.",
  );

  test("lists every page reachable from the home page", async ({ page, request }) => {
    test.slow();
    await page.goto("/mapa-strony");
    const listed = new Set(
      await page
        .getByRole("navigation", { name: "Mapa strony" })
        .getByRole("link")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? "")),
    );
    const reachable = await crawl(request);

    expect([...reachable].filter((path) => !listed.has(path))).toEqual([]);
    for (const path of listed) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
  });
});

test.describe("search", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("finds forms, pages and news as you type", async ({ page, problems }) => {
    await page.goto("/szukaj");
    await page.getByLabel(/Wpisz słowo/u).fill("legitymacja");

    await expect(page.getByRole("heading", { name: /^Dokumenty \(\d+\)$/u })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "W6: Wniosek o wydanie duplikatu legitymacji" }),
    ).toHaveAttribute("href", "/uczniowie/wzory-dokumentow#duplikaty");
    await expect(page).toHaveURL(/\?q=legitymacja$/u);
    expect(problems).toEqual([]);
  });

  test("reads the query from the address and reports empty results", async ({ page }) => {
    await page.goto("/szukaj?q=qwertyuiop");

    await expect(page.getByRole("status")).toContainText("Wyniki dla „qwertyuiop”: 0.");
  });

  test("the header search icon opens the search page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("link", { name: "Szukaj" }).first().click();

    await expect(page).toHaveURL(/\/szukaj$/u);
  });
});

test.describe("search without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("points to the site map", async ({ page }) => {
    await page.goto("/szukaj");

    await expect(page.getByRole("link", { name: "mapie strony" })).toHaveAttribute(
      "href",
      "/mapa-strony",
    );
  });
});

test.describe("missing pages and legal documents", () => {
  test("a missing page offers search and top tasks", async ({ page }) => {
    const response = await page.goto("/nie-istnieje");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("search")).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Najczęściej odwiedzane" })
        .getByRole("link", { name: /Dzwonki/u }),
    ).toHaveAttribute("href", "/uczniowie/dzwonki");
  });

  test("the privacy policy shows its version and sections", async ({ page }) => {
    await page.goto("/polityka-prywatnosci");

    await expect(
      page.getByText("Projekt do zatwierdzenia przez inspektora ochrony danych"),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Na tej stronie" }).getByRole("link"),
    ).toHaveCount(5);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`utility pages have no accessibility violations in ${colorScheme} theme`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      for (const path of [
        "/szukaj?q=lotnictwo",
        "/mapa-strony",
        "/polityka-prywatnosci",
        "/nie-istnieje",
      ]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

        expect(results.violations, path).toEqual([]);
      }
    });
  }

  test("never scroll sideways on a phone with the largest text", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem("zsm3.preferences", '{"text":"150"}');
    });
    for (const path of [
      "/szukaj?q=lotnictwo",
      "/mapa-strony",
      "/polityka-prywatnosci",
      "/nie-istnieje",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflow, path).toBe(0);
    }
  });
});
