import { expect, test } from "./fixtures.ts";

const article = {
  slug: "salon",
  date: "2026-10-28",
  category: "Technikum",
  title: "Salon maturzystów",
  lead: "Relacja z salonu",
  body: [{ type: "paragraph", content: [{ type: "text", text: "Treść relacji" }] }],
  status: "published",
};

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
  await page.route("**/api/panel/news?*", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: [article], total: 1, page: 1, pageSize: 20 }),
    }),
  );
});

test("a save based on an outdated version is refused and nothing is claimed as saved", async ({
  page,
}) => {
  const sent: unknown[] = [];
  await page.route("**/api/panel/news/2026/salon", async (route) => {
    if (route.request().method() === "PUT") {
      sent.push(route.request().postDataJSON());
      await route.fulfill({
        status: 409,
        contentType: "application/problem+json",
        body: JSON.stringify({ type: "about:blank", title: "Content Changed", status: 409 }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ item: article, revision: 3 }),
    });
  });
  await page.goto("/panel/aktualnosci");
  await page
    .getByRole("button", { name: "Edytuj aktualność Salon maturzystów z 2026-10-28" })
    .click();
  await expect(page.locator('[data-panel="editor"] input[name="title"]')).toHaveValue(
    "Salon maturzystów",
  );

  await page.locator('[data-panel="editor"] [name="lead"]').fill("Poprawiona relacja");
  await page.locator('[data-panel="news-save"]').click();

  await expect(page.locator('[data-panel="form-status"]')).toHaveText(
    "Ktoś w międzyczasie zmienił ten element i Twoje zmiany nie zostały zapisane. Skopiuj je, wczytaj element ponownie i nanieś je jeszcze raz.",
  );
  await expect(page.locator('[data-panel="editor"] [name="lead"]')).toHaveValue(
    "Poprawiona relacja",
  );
  expect(sent).toEqual([
    {
      entity: "news",
      mutation: {
        action: "save",
        item: expect.objectContaining({ lead: "Poprawiona relacja" }),
        expectedRevision: 3,
      },
    },
  ]);
});
