import { AxeBuilder } from "@axe-core/playwright";

import { expect, test } from "./fixtures.ts";

const TOKEN = "a".repeat(43);

test("request form fails closed without approved notices and service configuration", async ({
  page,
}) => {
  await page.goto("/e-wniosek");
  await expect(page.getByRole("heading", { name: "Wnioski online są niedostępne" })).toBeVisible();
  await expect(page.locator("[data-request-form]")).toHaveCount(0);
  await expect(page.locator(".cf-turnstile")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sprawdź stan złożonego wniosku" })).toHaveAttribute(
    "href",
    "/e-wniosek/status",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("status token remains in the fragment and withdrawal uses JSON POST", async ({ page }) => {
  const calls: string[] = [];
  await page.route("**/api/requests/status", async (route) => {
    calls.push(route.request().url());
    expect(route.request().postDataJSON()).toEqual({ token: TOKEN });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        type: "STUDENT_ID_RENEWAL",
        status: calls.length === 1 ? "ready" : "withdrawn",
        updatedAt: "2026-10-26T12:00:00.000Z",
        collectionMessage: calls.length === 1 ? "Dokument gotowy do odbioru." : "",
      }),
    });
  });
  await page.route("**/api/requests/withdraw", async (route) => {
    calls.push(route.request().url());
    expect(route.request().postDataJSON()).toEqual({ token: TOKEN });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"status":"withdrawn"}',
    });
  });
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.goto(`/e-wniosek/status#${TOKEN}`);
  await expect(page.locator("[data-status-form]")).toHaveAttribute("method", "post");
  await expect(page.getByText("Gotowy do odbioru", { exact: true })).toBeVisible();
  await expect(page.getByText("Dokument gotowy do odbioru.")).toBeVisible();
  await page.getByRole("button", { name: "Wycofaj wniosek" }).click();
  await expect(page.getByText("Wycofany", { exact: true })).toBeVisible();
  expect(calls).toHaveLength(3);
  expect(calls.every((url) => !url.includes(TOKEN))).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("invalid fragment does not reach the API", async ({ page }) => {
  const calls: string[] = [];
  await page.route("**/api/requests/**", (route) => {
    calls.push(route.request().url());
    void route.abort();
  });
  await page.goto("/e-wniosek/status#invalid");
  await expect(page.getByRole("alert")).toContainText("nieprawidłowy kod");
  expect(calls).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("invalid code and missing request move focus to useful errors", async ({ page }) => {
  await page.route("**/api/requests/status", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/problem+json",
      body: '{"title":"Not Found"}',
    });
  });
  await page.goto("/e-wniosek/status");
  await page.getByRole("button", { name: "Sprawdź stan" }).click();
  await expect(page.getByLabel("Kod z linku do wniosku")).toBeFocused();
  await expect(page.getByLabel("Kod z linku do wniosku")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Kod z linku do wniosku").fill(TOKEN);
  await page.getByRole("button", { name: "Sprawdź stan" }).click();
  await expect(page.getByRole("alert")).toContainText("Nie znaleziono wniosku");
  await expect(page.getByRole("alert")).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
