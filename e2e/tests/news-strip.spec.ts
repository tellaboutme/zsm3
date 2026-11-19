import { expect, test } from "./fixtures.ts";

test.describe("home news strip", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("moves one card per arrow and stops at both ends", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const strip = page.locator("[data-news-strip]");
    const count = strip.locator("[data-strip-count]");
    const newer = strip.getByRole("button", { name: "Nowsze aktualności" });
    const older = strip.getByRole("button", { name: "Starsze aktualności" });

    await expect(count).toHaveText(/^1 z \d+$/u);
    await expect(newer).toBeDisabled();
    await older.click();
    await expect(count).toHaveText(/^2 z \d+$/u);
    await expect(newer).toBeEnabled();
    const total = Number((await count.textContent())?.split(" z ")[1]);
    for (let step = 2; step < total; step += 1) {
      await older.click();
    }
    await expect(count).toHaveText(`${String(total)} z ${String(total)}`);
    await expect(older).toBeDisabled();
    await expect(
      strip.getByRole("link", { name: "Wszystkie aktualności" }).last(),
    ).toBeInViewport();
  });

  test("lists the newest news first", async ({ page }) => {
    await page.goto("/");
    const dates = await page
      .locator("[data-news-strip] time")
      .evaluateAll((items) => items.map((item) => item.getAttribute("datetime") ?? ""));
    expect(dates.length).toBeGreaterThan(1);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
