import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";
import { fakePanel, fakeRequest, pageProblems, type FakeRequest } from "./panel-requests-fake.ts";

const detail = '[data-panel="request-detail"]';
const feedback = '[data-panel="request-feedback"]';
const ERASED = { firstName: null, lastName: null, className: null, email: null } as const;

async function open(page: Page, records: FakeRequest[], role = "secretariat") {
  const fake = await fakePanel(page, role, records, 20);
  await page.goto("/panel/wnioski");
  await page.getByRole("button", { name: `Szczegóły wniosku nr ${records[0]?.id ?? ""}` }).click();
  await expect(page.locator(detail)).toBeVisible();
  await expect(page.locator('[data-panel="request-title"]')).toBeFocused();
  return fake;
}

test.describe("staff request detail", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("shows the applicant only in the detail", async ({ page, problems, browserName }) => {
    await open(page, [fakeRequest(1, { note: "Odbiór po 14:00" })]);
    const facts = page.locator('[data-panel="request-facts"]');
    await expect(facts).toContainText("Anna Nowak");
    await expect(facts).toContainText("anna.nowak@example.com");
    await expect(facts).toContainText("2TI");
    await expect(facts).toContainText("Odbiór po 14:00");
    await expect(page.locator('[data-panel="request-pii"]')).toBeHidden();
    expect(page.url()).not.toContain("anna");
    expect(pageProblems(problems, browserName)).toEqual([]);
  });

  test("explains erased and unreadable personal data", async ({ page }) => {
    await open(page, [
      fakeRequest(2, { ...ERASED, status: "withdrawn", piiErasedAt: "2026-10-23T12:00:00.000Z" }),
      fakeRequest(1, ERASED),
    ]);
    await expect(page.locator('[data-panel="request-pii"]')).toHaveText(
      "Dane osobowe usunięto 23 paź 2026, 14:00 (wycofanie wniosku albo koniec okresu przechowywania).",
    );
    await expect(page.locator('[data-panel="request-actions"] button')).toHaveCount(0);

    await page.getByRole("button", { name: `Szczegóły wniosku nr ${fakeRequest(1).id}` }).click();
    await expect(page.locator('[data-panel="request-pii"]')).toContainText(
      "Nie udało się odczytać danych osobowych",
    );
    await expect(page.locator('[data-panel="request-facts"]')).not.toContainText("@");
  });

  test("moves a request forward and updates its row", async ({ page }) => {
    const fake = await open(page, [fakeRequest(1)]);
    const actions = page.locator('[data-panel="request-actions"] button');
    await expect(actions).toHaveText(["Przyjmij do realizacji", "Odrzuć wniosek"]);
    await expect(page.getByRole("button", { name: /Wycof/u })).toHaveCount(0);

    await page.getByRole("button", { name: "Przyjmij do realizacji" }).click();
    await expect(page.locator(feedback)).toHaveText("Zapisano. Nowy status: W trakcie.");
    await expect(actions).toHaveText(["Oznacz jako gotowy do odbioru", "Odrzuć wniosek"]);
    await expect(page.locator('[data-panel="request-rows"] .panel-status')).toHaveText("W trakcie");
    expect(fake.posted).toEqual([
      { id: fakeRequest(1).id, to: "in_progress", expectedStatus: "submitted" },
    ]);
  });

  test("asks before rejecting and can be cancelled from the keyboard", async ({ page }) => {
    const fake = await open(page, [fakeRequest(1)]);
    const reject = page.getByRole("button", { name: "Odrzuć wniosek" }).first();
    await reject.click();
    const yes = page.locator('[data-panel="confirm-yes"]');
    await expect(yes).toBeFocused();
    await expect(page.locator('[data-panel="confirm-text"]')).toContainText("e-mail o odrzuceniu");
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-panel="request-confirm"]')).toBeHidden();
    await expect(reject).toBeFocused();
    expect(fake.posted).toEqual([]);

    await page.keyboard.press("Enter");
    await expect(yes).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(feedback)).toHaveText("Zapisano. Nowy status: Odrzucony.");
    await expect(page.locator('[data-panel="request-actions"] button')).toHaveCount(0);
    expect(fake.posted).toEqual([
      { id: fakeRequest(1).id, to: "rejected", expectedStatus: "submitted" },
    ]);
  });

  test("reloads the stored state on a conflict instead of overwriting it", async ({ page }) => {
    const fake = await open(page, [fakeRequest(1, { status: "in_progress" })]);
    fake.transition = (record) => {
      Object.assign(record, { status: "rejected", updatedAt: "2026-10-24T09:00:00.000Z" });
      return { status: 409, apply: false };
    };
    await page.getByRole("button", { name: "Oznacz jako gotowy do odbioru" }).click();
    await page.locator('[data-panel="confirm-yes"]').click();
    await expect(page.locator(feedback)).toContainText("Ktoś inny zmienił ten wniosek");
    await expect(page.locator('[data-panel="request-facts"]')).toContainText("Odrzucony");
    await expect(page.locator('[data-panel="request-actions"] button')).toHaveCount(0);
  });

  test("lets the server refuse a change decided on a stale view", async ({ page }) => {
    const fake = await open(page, [fakeRequest(1)]);
    Object.assign(fake.records[0] ?? {}, {
      status: "in_progress",
      updatedAt: "2026-10-24T09:00:00.000Z",
    });
    await page.getByRole("button", { name: "Odrzuć wniosek" }).click();
    await page.locator('[data-panel="confirm-yes"]').click();
    await expect(page.locator(feedback)).toContainText("Ktoś inny zmienił ten wniosek");
    await expect(page.locator('[data-panel="request-facts"]')).toContainText("W trakcie");
    expect(fake.posted).toEqual([
      { id: fakeRequest(1).id, to: "rejected", expectedStatus: "submitted" },
    ]);
    expect(fake.records[0]?.status).toBe("in_progress");
  });

  test("drops the previous request when the next one cannot be loaded", async ({ page }) => {
    await open(page, [fakeRequest(2), fakeRequest(1)]);
    await expect(page.locator('[data-panel="request-actions"] button')).toHaveCount(2);
    await page.route(`**/api/panel/requests/${fakeRequest(1).id}`, async (route) =>
      route.fulfill({ status: 500, contentType: "application/problem+json", body: "{}" }),
    );
    await page.getByRole("button", { name: `Szczegóły wniosku nr ${fakeRequest(1).id}` }).click();
    await expect(page.locator(feedback)).toHaveText(
      "Błąd serwera. Odczekaj chwilę i spróbuj ponownie.",
    );
    await expect(page.locator('[data-panel="request-actions"] button')).toHaveCount(0);
    await expect(page.locator('[data-panel="request-facts"]')).toBeEmpty();
    await expect(page.locator('[data-panel="request-title"]')).toHaveText("Szczegóły wniosku");
  });

  test("reports a refused transition and a lost connection", async ({ page }) => {
    const fake = await open(page, [fakeRequest(1)]);
    fake.transition = () => ({ status: 422, apply: false });
    await page.getByRole("button", { name: "Przyjmij do realizacji" }).click();
    await expect(page.locator(feedback)).toContainText("Tej zmiany nie można wykonać");

    fake.transition = () => "abort";
    await page.getByRole("button", { name: "Przyjmij do realizacji" }).click();
    await expect(page.locator(feedback)).toHaveText(
      "Brak połączenia z serwerem. Spróbuj ponownie. Status wniosku mógł się nie zmienić.",
    );
    await expect(page.getByRole("button", { name: "Przyjmij do realizacji" })).toBeEnabled();
  });
});
