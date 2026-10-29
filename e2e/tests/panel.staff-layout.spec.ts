import { expect, test } from "./fixtures.ts";

test("staff form and role list fit narrow and wide screens", async ({ page }) => {
  await page.route("**/api/panel/me", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ email: "dev@zsm3.local", role: "admin" }),
    }),
  );
  await page.route("**/api/panel/staff", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            email: "dev@zsm3.local",
            role: "admin",
            active: true,
            updatedAt: "2026-10-28T00:00:00Z",
          },
        ],
      }),
    }),
  );

  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/panel/pracownicy");
    await expect(page.locator('[data-panel="staff-rows"] li')).toHaveCount(1);
    await expect(page.locator('[data-panel="role"]')).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(dimensions.scroll).toBe(dimensions.client);
  }
});
