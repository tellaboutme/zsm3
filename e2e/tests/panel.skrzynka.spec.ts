import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";
import { HOSTILE, fakeQuestion, fakeQuestionsPanel } from "./panel-questions-fake.ts";
import { pageProblems } from "./panel-requests-fake.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const REDACTED = "Czy ktoś może mi pomóc w sprawie konfliktu w klasie?";
const ANSWER = "Przyjdź do pedagoga w czasie dyżuru albo porozmawiaj z wychowawcą.";

async function openFirst(page: Page): Promise<void> {
  await page.goto("/panel/skrzynka");
  await page
    .getByRole("button", {
      name: /^Otwórz pytanie: wskazany adresat: Pedagog szkolny · wpłynęło 12/u,
    })
    .click();
  await expect(page.locator('[data-panel="question-title"]')).toBeFocused();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("Skrzynka moderation", () => {
  test("shows a hostile question as plain text and publishes only the redacted draft", async ({
    page,
    problems,
    browserName,
  }) => {
    const fake = await fakeQuestionsPanel(page, "counsellor", [
      fakeQuestion(2),
      fakeQuestion(1, { status: "rejected" }),
    ]);
    await openFirst(page);

    const original = page.locator('[data-panel="question-original"]');
    await expect(original).toHaveText(HOSTILE);
    await expect(original.locator("img")).toHaveCount(0);
    expect(await page.title()).not.toBe("zhakowane");
    await expect(page.getByLabel("Pytanie do publikacji")).toHaveValue("");
    await page.getByLabel("Pytanie do publikacji").fill(REDACTED);
    await page.getByLabel("Odpowiedź", { exact: true }).fill(ANSWER);
    await page.getByRole("button", { name: "Zapisz szkic" }).click();
    await expect(page.locator('[data-panel="question-feedback"]')).toHaveText(
      "Zapisano szkic. Nic nie zostało opublikowane.",
    );
    await page.getByRole("button", { name: "Opublikuj pytanie i odpowiedź" }).click();
    await expect(page.locator('[data-panel="confirm-text"]')).toContainText(
      "widoczne dla wszystkich",
    );
    await expect(page.locator('[data-panel="confirm-hints"]')).toContainText("konkretne osoby");
    const review = page.getByRole("checkbox", { name: /^Sprawdziłem\/am pytanie i odpowiedź/u });
    await expect(review).toBeFocused();
    await page.getByRole("button", { name: "Tak, opublikuj" }).click();
    await expect(page.locator('[data-panel="question-feedback"]')).toContainText(
      "zaznacz potwierdzenie",
    );
    await expect(review).toBeFocused();
    expect(fake.writes).toHaveLength(1);
    await review.check();
    await page.getByRole("button", { name: "Tak, opublikuj" }).click();

    await expect(page.locator('[data-panel="question-feedback"]')).toHaveText(
      "Opublikowano pytanie i odpowiedź.",
    );
    await expect(page.locator('[data-panel="question-erased"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "Zobacz na stronie" })).toHaveAttribute(
      "href",
      "/skrzynka/abcdefghjkmn",
    );
    expect(fake.writes).toEqual([
      {
        path: `/api/panel/questions/${fakeQuestion(2).id}/draft`,
        body: { expectedVersion: 1, question: REDACTED, answer: ANSWER },
      },
      {
        path: `/api/panel/questions/${fakeQuestion(2).id}/decision`,
        body: { action: "publish", expectedVersion: 2, privacyReviewed: true },
      },
    ]);
    expect(pageProblems(problems, browserName)).toEqual([]);
  });

  test("will not publish while the draft has unsaved changes", async ({ page }) => {
    const fake = await fakeQuestionsPanel(page, "counsellor", [
      fakeQuestion(2, {
        status: "draft",
        version: 2,
        draft: { question: REDACTED, answer: ANSWER },
      }),
    ]);
    await openFirst(page);

    await page.getByLabel("Odpowiedź", { exact: true }).fill(`${ANSWER} Dopisek.`);
    await page.getByRole("button", { name: "Opublikuj pytanie i odpowiedź" }).click();

    await expect(page.locator('[data-panel="question-feedback"]')).toContainText(
      "Masz niezapisane zmiany",
    );
    await expect(page.locator('[data-panel="question-confirm"]')).toBeHidden();
    expect(fake.writes).toEqual([]);
  });

  test("reports another moderator's change instead of overwriting it", async ({ page }) => {
    const fake = await fakeQuestionsPanel(page, "counsellor", [fakeQuestion(2)]);
    await openFirst(page);
    fake.conflict = true;

    await page.getByRole("button", { name: "Odrzuć pytanie" }).click();
    await page.getByRole("button", { name: "Tak, odrzuć" }).click();

    await expect(page.locator('[data-panel="question-feedback"]')).toContainText(
      "Ktoś inny zmienił to pytanie",
    );
    expect(fake.items[0]?.status).toBe("received");
  });

  test("cancels a confirmation with Escape and returns focus", async ({ page }) => {
    await fakeQuestionsPanel(page, "counsellor", [fakeQuestion(2)]);
    await openFirst(page);
    const reject = page.getByRole("button", { name: "Odrzuć pytanie" });

    await reject.click();
    await expect(page.getByRole("button", { name: "Tak, odrzuć" })).toBeFocused();
    await page.keyboard.press("Escape");

    await expect(page.locator('[data-panel="question-confirm"]')).toBeHidden();
    await expect(reject).toBeFocused();
  });

  test("keeps an unreadable question stored but closed to editing and publication", async ({
    page,
  }) => {
    await fakeQuestionsPanel(page, "counsellor", [
      fakeQuestion(2, { status: "draft", version: 2, question: null, unreadable: ["question"] }),
    ]);
    await openFirst(page);

    await expect(page.locator('[data-panel="question-erased"]')).toContainText(
      "Zapis jest zachowany",
    );
    await expect(page.locator('[data-panel="question-editor"]')).toBeHidden();
    await expect(page.getByRole("button", { name: "Opublikuj pytanie i odpowiedź" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Odrzuć pytanie" })).toBeVisible();
  });

  test("keeps other staff out of the questions", async ({ page }) => {
    const fake = await fakeQuestionsPanel(page, "admin", [fakeQuestion(2)]);
    await page.goto("/panel/skrzynka");

    await expect(page.locator('[data-panel="gate-text"]')).toContainText("Brak uprawnień");
    await expect(page.locator('[data-panel="app"]')).toBeHidden();
    expect(fake.writes).toEqual([]);
  });
});

test.describe("Skrzynka moderation accessibility", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no violations with a confirmation open in ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await fakeQuestionsPanel(page, "counsellor", [
        fakeQuestion(2, {
          status: "draft",
          version: 2,
          draft: { question: REDACTED, answer: ANSWER },
        }),
      ]);
      await openFirst(page);
      await page.getByRole("button", { name: "Opublikuj pytanie i odpowiedź" }).click();
      await expect(page.locator('[data-panel="confirm-review"]')).toBeVisible();

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("fits a phone at 200% text", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await fakeQuestionsPanel(page, "counsellor", [fakeQuestion(2)]);
    await openFirst(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await page.getByRole("button", { name: "Odrzuć pytanie" }).click();
    await expect(page.getByRole("button", { name: "Tak, odrzuć" })).toBeVisible();
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth === document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);
  });
});
