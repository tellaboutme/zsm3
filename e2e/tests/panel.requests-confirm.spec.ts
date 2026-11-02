import { expect, test } from "./fixtures.ts";
import { fakePanel, fakeRequest } from "./panel-requests-fake.ts";

const confirm = '[data-panel="request-confirm"]';
const feedback = '[data-panel="request-feedback"]';

test.describe("staff request confirmation", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("a direct action closes a pending confirmation", async ({ page }) => {
    const fake = await fakePanel(page, "secretariat", [fakeRequest(1)], 20);
    await page.goto("/panel/wnioski");
    await page.getByRole("button", { name: `Szczegóły wniosku nr ${fakeRequest(1).id}` }).click();
    await page.getByRole("button", { name: "Odrzuć wniosek" }).click();
    await expect(page.locator(confirm)).toBeVisible();

    await page.getByRole("button", { name: "Przyjmij do realizacji" }).click();

    await expect(page.locator(feedback)).toHaveText("Zapisano. Nowy status: W trakcie.");
    await expect(page.locator(confirm)).toBeHidden();
    expect(fake.posted.map((post) => post.to)).toEqual(["in_progress"]);
  });

  test("cannot be cancelled once the change is being sent", async ({ page }) => {
    const fake = await fakePanel(page, "secretariat", [fakeRequest(1)], 20);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/panel/requests/*/status", async (route) => {
      await held;
      await route.fallback();
    });
    await page.goto("/panel/wnioski");
    await page.getByRole("button", { name: `Szczegóły wniosku nr ${fakeRequest(1).id}` }).click();
    await page.getByRole("button", { name: "Odrzuć wniosek" }).click();
    await page.getByRole("button", { name: "Tak, odrzuć wniosek" }).click();

    await expect(page.getByRole("button", { name: "Anuluj" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.locator(confirm)).toBeVisible();

    release();
    await expect(page.locator(feedback)).toHaveText("Zapisano. Nowy status: Odrzucony.");
    expect(fake.posted.map((post) => post.to)).toEqual(["rejected"]);
  });
});
