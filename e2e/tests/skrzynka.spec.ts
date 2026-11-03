import { AxeBuilder } from "@axe-core/playwright";
import type { Page, Request } from "@playwright/test";

import { expect, test } from "./fixtures.ts";
import { pageProblems } from "./panel-requests-fake.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const TURNSTILE_STUB =
  "window.turnstile = { getResponse: () => 'stub-token', reset: () => undefined };";
const QUESTION = "Jak mogę umówić się na rozmowę, jeśli nie chcę, żeby klasa o tym wiedziała?";

async function stubTurnstile(page: Page): Promise<void> {
  await page.route("https://challenges.cloudflare.com/**", async (route) =>
    route.fulfill({
      contentType: "text/javascript",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
      body: TURNSTILE_STUB,
    }),
  );
}

async function fillQuestion(page: Page, text = QUESTION): Promise<void> {
  await page.getByRole("radio", { name: "Psycholog szkolny" }).check();
  await page.getByLabel("Twoje pytanie").fill(text);
  await page.getByRole("checkbox", { name: /Rozumiem, że pytanie czytają/u }).check();
}

async function noScroll(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return document.documentElement.scrollWidth === document.documentElement.clientWidth;
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubTurnstile(page);
});

test.describe("Skrzynka public page", () => {
  test("puts urgent help before the form and lists approved answers", async ({
    page,
    problems,
    browserName,
  }) => {
    await page.goto("/skrzynka");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Skrzynka #OgarniamŻycie");
    const helpline = page.getByRole("link", { name: /116 111/u }).first();
    await expect(helpline).toHaveAttribute("href", "tel:116111");
    await expect(page.getByRole("link", { name: /^112/u }).first()).toHaveAttribute(
      "href",
      "tel:112",
    );
    const order = await page.evaluate(() => {
      const help = document.querySelector(".help-lines");
      const form = document.querySelector("[data-question-form]");
      return help !== null && form !== null
        ? help.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING
        : 0;
    });
    expect(order).toBeGreaterThan(0);
    await expect(page.getByText("Skrzynka nie jest telefonem zaufania")).toBeVisible();
    await expect(page.locator(".question-list article")).toHaveCount(2);
    expect(pageProblems(problems, browserName)).toEqual([]);
  });

  test("sends only the anonymous fields and confirms without echoing the text", async ({
    page,
  }) => {
    const sent: Request[] = [];
    await page.route("**/api/questions", async (route) => {
      sent.push(route.request());
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ received: true }),
      });
    });
    await page.goto("/skrzynka");
    await fillQuestion(page);

    await page.getByRole("button", { name: "Wyślij pytanie" }).click();

    const success = page.getByRole("heading", { name: "Pytanie zostało wysłane" });
    await expect(success).toBeVisible();
    await expect(page.locator("[data-question-success]")).toBeFocused();
    const body: unknown = sent[0]?.postDataJSON();
    expect(Object.keys(typeof body === "object" && body !== null ? body : {}).toSorted()).toEqual([
      "addressee",
      "formKey",
      "honeypot",
      "question",
      "rulesAccepted",
      "submittedAtMs",
      "turnstileToken",
    ]);
    expect(await sent[0]?.headerValue("cookie")).toBeNull();
    await expect(page.locator("body")).not.toContainText(QUESTION);
    await page.getByRole("button", { name: "Zadaj kolejne pytanie" }).click();
    await expect(page.getByLabel("Twoje pytanie")).toHaveValue("");
    await expect(page.getByLabel("Twoje pytanie")).toBeFocused();
  });

  test("explains what to fix before sending anything", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/questions", async (route) => {
      calls += 1;
      await route.abort();
    });
    await page.goto("/skrzynka");

    await page.getByRole("button", { name: "Wyślij pytanie" }).click();
    await expect(page.locator("#question-errors")).toHaveText(
      "Wybierz, do kogo kierujesz pytanie.",
    );
    await expect(page.getByRole("radio", { name: "Pedagog szkolny" })).toBeFocused();

    await fillQuestion(page, "Krótko");
    await page.getByRole("button", { name: "Wyślij pytanie" }).click();
    await expect(page.locator("#question-error")).toContainText("od 10 do 1500 znaków");
    await expect(page.getByLabel("Twoje pytanie")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Twoje pytanie")).toBeFocused();
    expect(calls).toBe(0);
  });

  test("tells the student when the box refused the question", async ({ page }) => {
    await page.route("**/api/questions", async (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/problem+json",
        body: JSON.stringify({ type: "about:blank", title: "Too Many Requests", status: 429 }),
      }),
    );
    await page.goto("/skrzynka");
    await fillQuestion(page);

    await page.getByRole("button", { name: "Wyślij pytanie" }).click();

    await expect(page.locator("#question-errors")).toContainText("zbyt wiele pytań");
    await expect(page.getByLabel("Twoje pytanie")).toHaveValue(QUESTION);
  });

  test("counts the characters while typing", async ({ page }) => {
    await page.goto("/skrzynka");
    await page.getByLabel("Twoje pytanie").fill("Dwanaście zn");
    await expect(page.locator("[data-question-count]")).toHaveText("12 z 1500 znaków");
  });
});

test.describe("Skrzynka answers", () => {
  test("opens a published answer that search engines are asked to skip", async ({ page }) => {
    await page.goto("/skrzynka");
    await page.locator(".question-list h3 a").first().click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pytanie");
    await expect(page.getByRole("heading", { name: "Odpowiedź" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/u);
    await expect(page.getByRole("link", { name: /116 111/u }).first()).toBeVisible();
  });

  test("answers 404 for unknown, malformed and out-of-range addresses", async ({ page }) => {
    for (const path of [
      "/skrzynka/abcdefghjkmn",
      "/skrzynka/ABC",
      "/skrzynka/strona/1",
      "/skrzynka/strona/2",
      "/skrzynka/strona/x",
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });

  test("keeps the whole box out of the sitemap and the index", async ({ page, request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("/skrzynka");
    await page.goto("/skrzynka");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/u);
  });
});

test.describe("Skrzynka accessibility and layout", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no violations on the page and an answer in ${colorScheme} theme`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/skrzynka");
      await page.getByRole("button", { name: "Wyślij pytanie" }).click();
      await expect(page.locator("#question-errors")).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
      await page.locator(".question-list h3 a").first().click();
      await expect(page.getByRole("heading", { name: "Odpowiedź" })).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
    });
  }

  test("fits a phone at 200% text without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/skrzynka");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(await noScroll(page)).toBe(true);
    await page.locator(".question-list h3 a").first().click();
    await expect(page.getByRole("heading", { name: "Odpowiedź" })).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(await noScroll(page)).toBe(true);
  });
});
