import { AxeBuilder } from "@axe-core/playwright";
import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const LINK = /href="(\/[^"#?]*)/gu;
const NEWS_ARCHIVE = "/aktualnosci/";

function internalLinks(html: string): readonly string[] {
  return [...html.matchAll(LINK)].flatMap((match) =>
    match[1] === undefined || match[1].startsWith("/media/") || /\.[a-z]+$/u.test(match[1])
      ? []
      : [match[1]],
  );
}

interface Crawl {
  readonly pages: ReadonlySet<string>;
  readonly missing: ReadonlySet<string>;
}

async function crawl(request: APIRequestContext): Promise<Crawl> {
  const pages = new Set<string>();
  const missing = new Set<string>();
  const queue = ["/"];
  const seen = new Set(queue);
  while (queue.length > 0) {
    const path = queue.shift() ?? "/";
    const response = await request.get(path);
    if (response.status() === 404) {
      missing.add(path);
    }
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
  return { pages, missing };
}

test.describe("site map", () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== "chromium" || isMobile,
    "One crawl is enough.",
  );

  test("lists every page reachable from the home page outside the news archive", async ({
    page,
    request,
  }) => {
    test.slow();
    await page.goto("/mapa-strony");
    const listed = new Set(
      await page
        .getByRole("navigation", { name: "Mapa strony" })
        .getByRole("link")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? "")),
    );
    const { pages: reachable, missing } = await crawl(request);

    const unlisted = [...reachable].filter((path) => !listed.has(path));

    expect([...missing].toSorted()).toEqual([]);

    expect(unlisted.filter((path) => !path.startsWith(NEWS_ARCHIVE))).toEqual([]);
    expect(unlisted.length).toBeGreaterThan(0);
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

  test("finds seeded news together with static pages", async ({ page }) => {
    await page.goto("/szukaj?q=egzamin");

    await expect(page.getByRole("heading", { name: /^Aktualności \(\d+\)$/u })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Salon Maturzystów Perspektywy 2026" }),
    ).toHaveAttribute("href", "/aktualnosci/2026/salon-maturzystow-2026");
    await expect(
      page.getByRole("link", { name: "Egzamin zawodowy, sesja zimowa: część pisemna" }),
    ).toBeVisible();
  });

  test("finds a class however its code is typed and marks it", async ({ page }) => {
    await page.goto("/szukaj?q=4TP");

    await expect(page.getByRole("heading", { name: "Klasy i sale (1)" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Klasa 4 Tp" })).toHaveAttribute(
      "href",
      "/rodzice/wywiadowki",
    );
    await expect(page.locator(".results mark").first()).toHaveText("4 Tp");
  });

  test("forgives a typo and suggests a word that exists", async ({ page }) => {
    await page.goto("/szukaj?q=dzwunkiy");

    await expect(
      page.getByRole("link", { name: "Dzwonki: godziny lekcji i przerw" }),
    ).toBeVisible();
    await page.getByLabel(/Wpisz słowo/u).fill("legitymcjaaa");
    await page.getByRole("button", { name: "legitymacja" }).click();

    await expect(page.getByLabel(/Wpisz słowo/u)).toHaveValue("legitymacja");
    await expect(page.getByRole("heading", { name: /^Dokumenty \(\d+\)$/u })).toBeVisible();
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

  test("a missing page shows results while typing and keeps its address", async ({ page }) => {
    await page.goto("/nie-istnieje");
    await page.getByRole("searchbox", { name: "Czego szukasz?" }).fill("4tp");

    await expect(page.getByRole("link", { name: "Klasa 4 Tp" })).toBeVisible();
    await expect(page).toHaveURL(/\/nie-istnieje$/u);
    await page.getByRole("searchbox", { name: "Czego szukasz?" }).press("Enter");

    await expect(page).toHaveURL(/\/szukaj\?q=4tp$/u);
    await expect(page.getByRole("link", { name: "Klasa 4 Tp" })).toBeVisible();
  });

  test("the privacy policy shows its version and sections", async ({ page }) => {
    await page.goto("/polityka-prywatnosci");

    await expect(page.getByText("Dokument obowiązujący")).toBeVisible();
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
