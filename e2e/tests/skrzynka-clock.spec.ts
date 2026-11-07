import { expect, test } from "./fixtures.ts";
import { fillQuestion, stubTurnstile } from "./skrzynka-support.ts";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubTurnstile(page);
});

test.describe("Skrzynka form timing", () => {
  test("sends a question whatever the student's clock shows", async ({ page }) => {
    const statuses: number[] = [];
    await page.clock.install({ time: new Date("1999-12-31T23:59:58Z") });
    await page.route("**/api/questions", async (route) => {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ received: true }),
      });
    });
    page.on("response", (response) => {
      if (response.url().endsWith("/api/questions")) statuses.push(response.status());
    });
    await page.goto("/skrzynka");
    await fillQuestion(page);

    await page.getByRole("button", { name: "Wyślij pytanie" }).click();

    await expect(page.getByRole("heading", { name: "Pytanie zostało wysłane" })).toBeVisible();
    expect(statuses).toEqual([202]);
  });
});
