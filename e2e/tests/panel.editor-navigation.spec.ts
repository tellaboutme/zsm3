import { expect, test } from "./fixtures.ts";

const news = Array.from(Array.from({ length: 11 }).keys(), (index) => ({
  slug: `entry-${String(index + 1)}`,
  date: "2026-10-28",
  category: "Technikum",
  title: `Entry ${String(index + 1)}`,
  lead: "School news summary",
  body: [{ type: "paragraph", content: [{ type: "text", text: "School news body" }] }],
  status: "published",
}));
const pages = Array.from(Array.from({ length: 16 }).keys(), (index) => ({
  path: `/szkola/example-${String(index + 1)}`,
  title: `Page ${String(index + 1)}`,
  status: "published",
}));

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/panel/me", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ email: "dev@zsm3.local", role: "admin" }),
    }),
  );
  await page.route("**/api/panel/revisions/**", async (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [] }) }),
  );
});

test("news editor appears after selecting an item on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.route("**/api/panel/news?*", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: news, total: news.length, page: 1, pageSize: 20 }),
    }),
  );
  await page.route("**/api/panel/news/2026/entry-1", async (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ item: news[0] }) }),
  );
  await page.goto("/panel/aktualnosci");
  await expect(
    page.getByRole("button", { name: "Edytuj aktualność Entry 1 z 2026-10-28" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edytuj aktualność Entry 1 z 2026-10-28" }).click();
  await expect(page.locator('[data-panel="editor"] input[name="title"]')).toHaveValue("Entry 1");
  const top = await page
    .locator('[data-panel="editor"]')
    .evaluate((editor) => editor.getBoundingClientRect().top);
  expect(top).toBeGreaterThan(-1);
  expect(top).toBeLessThan(740);
});

test("page editor appears after selecting an item on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.route("**/api/panel/pages", async (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: pages }) }),
  );
  await page.route("**/api/panel/pages/**", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        item: {
          ...pages[0],
          kicker: "School",
          intro: "School page introduction",
          sections: [
            {
              id: "section",
              title: "Section",
              blocks: [
                {
                  type: "rich-text",
                  document: [
                    { type: "paragraph", content: [{ type: "text", text: "School page body" }] },
                  ],
                },
              ],
            },
          ],
        },
      }),
    }),
  );
  await page.goto("/panel/strony");
  await page.getByRole("button", { name: "Edytuj stronę /szkola/example-1", exact: true }).click();
  await expect(page.locator('[data-panel="editor"] input[name="title"]')).toHaveValue("Page 1");
  const top = await page
    .locator('[data-panel="editor"]')
    .evaluate((editor) => editor.getBoundingClientRect().top);
  expect(top).toBeGreaterThan(-1);
  expect(top).toBeLessThan(740);
});
