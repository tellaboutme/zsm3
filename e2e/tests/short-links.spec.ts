import { expect, test } from "./fixtures.ts";

test("an open short link sends the visitor to the material", async ({ request }) => {
  const response = await request.get("/s/materia", { maxRedirects: 0 });

  expect(response.status()).toBe(302);
  expect(response.headers()["location"]).toBe("https://example.org/materialy/plan-lekcji.pdf");
});

test("a code typed in capitals resolves the same way", async ({ request }) => {
  const response = await request.get("/s/MATERIA", { maxRedirects: 0 });

  expect(response.status()).toBe(302);
});

test("a revoked link explains itself instead of returning a bare error", async ({ page }) => {
  const response = await page.goto("/s/wygasny");

  expect(response?.status()).toBe(410);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Link wygasł");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/u);
});

test("an unknown code answers 404 with the same page frame", async ({ page }) => {
  const response = await page.goto("/s/nieznan");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nie znaleziono linku");
});

test("a protected link asks for the password without revealing the target", async ({ page }) => {
  const response = await page.goto("/s/zhasqem");

  expect(response?.status()).toBe(200);
  await expect(page.getByLabel("Hasło do materiału")).toBeVisible();
  await expect(page.locator("form")).toHaveAttribute("action", "/api/short-links/zhasqem");
  expect(await page.content()).not.toContain("karta-pracy.pdf");
});

test("the correct password redirects to the protected material", async ({ request }) => {
  const response = await request.post("/api/short-links/zhasqem", {
    form: { haslo: "zsm3-demo" },
    headers: { Origin: "http://127.0.0.1:8787" },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toBe("https://example.org/materialy/karta-pracy.pdf");
});

test("the password form refuses a guess and keeps the visitor on the page", async ({ page }) => {
  await page.goto("/s/zhasqem");
  await page.getByLabel("Hasło do materiału").fill("nieprawidlowe");
  await page.getByRole("button", { name: "Otwórz materiał" }).click();

  await expect(page).toHaveURL(/\/s\/zhasqem\?blad=/u);
  await expect(page.getByLabel("Hasło do materiału")).toBeVisible();
});
