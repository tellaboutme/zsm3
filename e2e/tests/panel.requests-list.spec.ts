import { expect, test } from "./fixtures.ts";
import { AT, fakePanel, fakeRequest, pageProblems } from "./panel-requests-fake.ts";

const rows = '[data-panel="request-rows"] > li';
const status = '[data-panel="status"]';

test.describe("staff requests list", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("pages through requests that share one timestamp", async ({
    page,
    problems,
    browserName,
  }) => {
    const fake = await fakePanel(page, "secretariat", [
      fakeRequest(1),
      fakeRequest(2, { status: "ready" }),
      fakeRequest(3, { type: "ENROLLMENT_CERTIFICATE" }),
    ]);

    await page.goto("/panel/wnioski");

    await expect(page.locator(rows)).toHaveCount(2);
    await expect(page.locator(status)).toHaveText("Wniosków na liście: 2.");
    await page.getByRole("button", { name: "Pokaż starsze" }).click();
    await expect(page.locator(rows)).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Pokaż starsze" })).toBeHidden();
    const ids = await page
      .locator(rows)
      .evaluateAll((items) => items.map((item) => item.getAttribute("data-request")));
    expect(new Set(ids).size).toBe(3);
    expect(fake.listed[1]).toBe(
      `/api/panel/requests?before=${encodeURIComponent(AT)}&beforeId=${fakeRequest(2).id}`,
    );
    await expect(page.locator(rows).first()).not.toContainText("Nowak");
    expect(pageProblems(problems, browserName)).toEqual([]);
  });

  test("filters by status and says when nothing matches", async ({ page }) => {
    const fake = await fakePanel(page, "admin", [
      fakeRequest(1),
      fakeRequest(2, { status: "ready" }),
    ]);
    await page.goto("/panel/wnioski");
    await expect(page.locator(rows)).toHaveCount(2);

    await page.getByLabel("Status").selectOption("ready");
    await expect(page.locator(rows)).toHaveCount(1);
    await expect(page.locator(rows)).toContainText("Gotowy do odbioru");
    expect(fake.listed.at(-1)).toBe("/api/panel/requests?status=ready");

    await page.getByLabel("Status").selectOption("rejected");
    await expect(page.locator(rows)).toHaveCount(0);
    await expect(page.locator(status)).toHaveText("Brak wniosków o statusie „Odrzucony”.");
  });

  test("keeps the open request marked and drops rows that leave the filter", async ({ page }) => {
    await fakePanel(page, "secretariat", [fakeRequest(1), fakeRequest(2)]);
    await page.goto("/panel/wnioski");
    await page.getByLabel("Status").selectOption("submitted");
    await expect(page.locator(rows)).toHaveCount(2);
    await page.getByRole("button", { name: `Szczegóły wniosku nr ${fakeRequest(2).id}` }).click();
    await page.getByRole("button", { name: "Odśwież listę" }).click();
    await expect(page.locator(`${rows}[aria-current="true"]`)).toHaveAttribute(
      "data-request",
      fakeRequest(2).id,
    );

    await page.getByRole("button", { name: "Przyjmij do realizacji" }).click();
    await expect(page.locator('[data-panel="request-feedback"]')).toHaveText(
      "Zapisano. Nowy status: W trakcie.",
    );
    await expect(page.locator(rows)).toHaveCount(1);
    await expect(page.locator(status)).toHaveText("Wniosków na liście: 1.");
  });

  test("clears the list when a new filter cannot be loaded", async ({ page }) => {
    await fakePanel(page, "secretariat", [fakeRequest(1), fakeRequest(2), fakeRequest(3)]);
    await page.goto("/panel/wnioski");
    await expect(page.getByRole("button", { name: "Pokaż starsze" })).toBeVisible();
    await page.route("**/api/panel/requests?status=ready", async (route) =>
      route.fulfill({ status: 500, contentType: "application/problem+json", body: "{}" }),
    );
    await page.getByLabel("Status").selectOption("ready");
    await expect(page.locator(status)).toHaveText(
      "Błąd serwera. Odczekaj chwilę i spróbuj ponownie.",
    );
    await expect(page.locator(rows)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pokaż starsze" })).toBeHidden();
  });

  test("tells the secretariat when there are no requests yet", async ({ page }) => {
    await fakePanel(page, "secretariat", []);
    await page.goto("/panel/wnioski");
    await expect(page.locator(status)).toHaveText("Nie ma jeszcze żadnych wniosków.");
    await expect(page.getByRole("link", { name: "Wnioski" })).toBeVisible();
  });

  test("keeps editors out and hides the section from them", async ({ page }) => {
    const fake = await fakePanel(page, "editor", [fakeRequest(1)]);
    await page.goto("/panel/wnioski");
    await expect(page.locator('[data-panel="gate-text"]')).toContainText(
      "Brak uprawnień do treści.",
    );
    await expect(page.locator('[data-panel="app"]')).toBeHidden();
    expect(fake.listed).toEqual([]);

    await page.goto("/panel");
    await expect(page.getByRole("heading", { name: "Panel obsługi treści" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Wnioski/u })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Dziennik", exact: true })).toHaveCount(0);
  });

  test("reports a refusal or a server failure of the list", async ({ page }) => {
    await fakePanel(page, "secretariat", []);
    await page.route("**/api/panel/requests", async (route) =>
      route.fulfill({ status: 403, contentType: "application/problem+json", body: "{}" }),
    );
    await page.goto("/panel/wnioski");
    await expect(page.locator(status)).toHaveText("Brak uprawnień do tej czynności.");

    await page.unroute("**/api/panel/requests");
    await page.route("**/api/panel/requests", async (route) => route.abort("connectionfailed"));
    await page.getByRole("button", { name: "Odśwież listę" }).click();
    await expect(page.locator(status)).toHaveText("Brak połączenia z serwerem. Spróbuj ponownie.");
  });
});
