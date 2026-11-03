import type { Page, Route } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

const CONFLICT =
  "Ktoś w międzyczasie zmienił ten element i Twoje zmiany nie zostały zapisane. Skopiuj je, wczytaj element ponownie i nanieś je jeszcze raz.";

const BODY = [{ type: "paragraph", content: [{ type: "text", text: "Treść relacji" }] }];

interface Fake {
  revision: number;
  status: "draft" | "published";
  readonly restores: number[];
}

function article(fake: Fake): object {
  return {
    slug: "salon",
    date: "2026-10-28",
    category: "Technikum",
    title: "Salon maturzystów",
    lead: "Relacja z salonu",
    body: BODY,
    status: fake.status,
  };
}

function contentPage(fake: Fake): object {
  return {
    path: "/szkola/historia",
    kicker: "Szkoła",
    title: "Historia szkoły",
    intro: "Jak powstała szkoła",
    status: fake.status,
    sections: [{ id: "opis", title: "Opis", blocks: [{ type: "rich-text", document: BODY }] }],
  };
}

function history(fake: Fake): object {
  return {
    items: Array.from(Array.from({ length: fake.revision }).keys(), (index) => ({
      revision: index + 1,
      at: "2026-10-28T10:00:00Z",
      actorEmail: null,
      title: `Wersja ${String(index + 1)}`,
      status: fake.status,
    })),
  };
}

function sentField(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

async function json(route: Route, body: object, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: status === 200 ? "application/json" : "application/problem+json",
    body: JSON.stringify(body),
  });
}

async function changed(route: Route, fake: Fake): Promise<void> {
  const state = fake;
  state.revision += 1;
  await json(route, { ok: true, revision: fake.revision });
}

async function fakeApi(page: Page, fake: Fake, view: (fake: Fake) => object): Promise<void> {
  await page.route("**/api/panel/me", async (route) =>
    json(route, { email: "dev@zsm3.local", role: "admin" }),
  );
  await page.route("**/api/panel/revisions/**", async (route) => {
    if (route.request().method() !== "POST") {
      await json(route, history(fake));
      return;
    }
    const expected = sentField(route.request().postDataJSON(), "expectedRevision");
    fake.restores.push(Number(expected));
    if (expected !== fake.revision) {
      await json(route, { type: "about:blank", title: "Content Changed", status: 409 }, 409);
      return;
    }
    await changed(route, fake);
  });
  await page.route(/\/api\/panel\/(news\/2026\/salon|pages\/szkola\/historia)$/u, async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await json(route, { item: view(fake), revision: fake.revision });
      return;
    }
    if (method === "PATCH") {
      const mutation = sentField(route.request().postDataJSON(), "mutation");
      const state = fake;
      state.status = sentField(mutation, "action") === "publish" ? "published" : "draft";
    }
    await changed(route, fake);
  });
  await page.route("**/api/panel/news?*", async (route) =>
    json(route, { items: [article(fake)], total: 1, page: 1, pageSize: 20 }),
  );
  await page.route("**/api/panel/pages", async (route) =>
    json(route, {
      items: [{ path: "/szkola/historia", title: "Historia szkoły", status: "draft" }],
    }),
  );
}

async function openArticle(page: Page): Promise<void> {
  await page.goto("/panel/aktualnosci");
  await page
    .getByRole("button", { name: "Edytuj aktualność Salon maturzystów z 2026-10-28" })
    .click();
  await expect(page.locator('[data-panel="editor"] input[name="title"]')).toHaveValue(
    "Salon maturzystów",
  );
}

async function restoreFirst(page: Page, rows: number): Promise<void> {
  await expect(page.locator('[data-panel="history-rows"] > li')).toHaveCount(rows);
  await page.getByRole("button", { name: "Przywróć wersję 1: Wersja 1" }).click();
}

const historyStatus = '[data-panel="history-status"]';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a restore after saving the article sends the revision the save produced", async ({
  page,
}) => {
  const fake: Fake = { revision: 2, status: "draft", restores: [] };
  await fakeApi(page, fake, article);
  await openArticle(page);
  await expect(page.locator('[data-panel="history-rows"] > li')).toHaveCount(2);

  await page.locator('[data-panel="editor"] [name="lead"]').fill("Poprawiona relacja");
  await page.locator('[data-panel="news-save"]').click();
  await restoreFirst(page, 3);

  await expect(page.locator(historyStatus)).toHaveText("Przywrócono wersję 1.");
  expect(fake.restores).toEqual([3]);
  await expect(page.locator('[data-panel="history-rows"] > li')).toHaveCount(4);
});

test("a restore after publishing sends the revision the publication produced", async ({ page }) => {
  const fake: Fake = { revision: 2, status: "draft", restores: [] };
  await fakeApi(page, fake, article);
  await openArticle(page);
  await expect(page.locator('[data-panel="history-rows"] > li')).toHaveCount(2);

  await page.locator('[data-panel="news-publish"]').click();
  await expect(page.locator('[data-panel="form-status"]')).toHaveText("Opublikowano.");
  await restoreFirst(page, 3);

  await expect(page.locator(historyStatus)).toHaveText("Przywrócono wersję 1.");
  expect(fake.restores).toEqual([3]);
});

test("a restore after withdrawing sends the revision the withdrawal produced", async ({ page }) => {
  const fake: Fake = { revision: 2, status: "published", restores: [] };
  await fakeApi(page, fake, article);
  await openArticle(page);
  await expect(page.locator('[data-panel="history-rows"] > li')).toHaveCount(2);

  await page.locator('[data-panel="news-unpublish"]').click();
  await expect(page.locator('[data-panel="form-status"]')).toHaveText("Wycofano publikację.");
  await restoreFirst(page, 3);

  await expect(page.locator(historyStatus)).toHaveText("Przywrócono wersję 1.");
  expect(fake.restores).toEqual([3]);
});

test("a restore after saving a page sends the revision the save produced", async ({ page }) => {
  const fake: Fake = { revision: 1, status: "draft", restores: [] };
  await fakeApi(page, fake, contentPage);
  await page.goto("/panel/strony");
  await page.getByRole("button", { name: "Edytuj stronę /szkola/historia", exact: true }).click();
  await expect(page.locator('[data-panel="editor"] input[name="title"]')).toHaveValue(
    "Historia szkoły",
  );
  await expect(page.locator('[data-panel="history-rows"] > li')).toHaveCount(1);

  await page.locator('[data-panel="editor"] input[name="title"]').fill("Historia ZSM3");
  await page.locator('[data-panel="pages-save"]').click();
  await expect(page.locator('[data-panel="form-status"]')).toHaveText("Zapisano stronę.");
  await restoreFirst(page, 2);

  await expect(page.locator(historyStatus)).toHaveText("Przywrócono wersję 1.");
  expect(fake.restores).toEqual([2]);
});

test("a restore over another editor's newer change is still refused", async ({ page }) => {
  const fake: Fake = { revision: 2, status: "draft", restores: [] };
  await fakeApi(page, fake, article);
  await openArticle(page);
  await expect(page.locator('[data-panel="history-rows"] > li')).toHaveCount(2);
  fake.revision = 3;

  await page.getByRole("button", { name: "Przywróć wersję 1: Wersja 1" }).click();

  await expect(page.locator(historyStatus)).toHaveText(CONFLICT);
  expect(fake.restores).toEqual([2]);
});
