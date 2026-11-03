import { expect, test } from "./fixtures.ts";

const SITE = "http://127.0.0.1:8787";

function offeredNames(browserName: string, readable: string, ascii: string): readonly string[] {
  return browserName === "webkit" ? [readable, readable.replaceAll(" ", "_"), ascii] : [readable];
}

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
    headers: { Origin: SITE },
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

test("a file download carries the readable name and an ASCII fallback", async ({ request }) => {
  const response = await request.post("/api/short-links/pdfmat3", {
    form: {},
    headers: { Origin: SITE },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toBe(
    'attachment; filename="Karta pracy - przyklad.pdf"; ' +
      "filename*=UTF-8''Karta%20pracy%20%E2%80%94%20przyk%C5%82ad.pdf",
  );
  expect(response.headers()["cache-control"]).toBe("private, no-store");
});

test("an open file link offers a download and never names a storage address", async ({
  page,
  browserName,
}) => {
  const response = await page.goto("/s/pdfmat3");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Materiał do pobrania");
  await expect(page.getByText("Karta pracy — przykład.pdf", { exact: false })).toBeVisible();
  expect(await page.content()).not.toMatch(/\/media\/|s\/[0-9a-f]{8}-/u);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Pobierz plik" }).click();
  expect(
    offeredNames(browserName, "Karta pracy — przykład.pdf", "Karta pracy - przyklad.pdf"),
  ).toContain((await download).suggestedFilename());
});

test("a protected file link names nothing until the password matches", async ({
  page,
  browserName,
}) => {
  await page.goto("/s/pdfzhas");
  await expect(page.getByLabel("Hasło do materiału")).toBeVisible();
  expect(await page.content()).not.toContain("Klucz odpowiedzi");

  await page.getByLabel("Hasło do materiału").fill("nieprawidlowe");
  await page.getByRole("button", { name: "Otwórz materiał" }).click();
  await expect(page).toHaveURL(/\/s\/pdfzhas\?blad=haslo/u);

  await page.getByLabel("Hasło do materiału").fill("zsm3-demo");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Otwórz materiał" }).click();
  expect(
    offeredNames(browserName, "Klucz odpowiedzi — przykład.pdf", "Klucz odpowiedzi - przyklad.pdf"),
  ).toContain((await download).suggestedFilename());
});

test("a file is not served to another site's form", async ({ request }) => {
  const response = await request.post("/api/short-links/pdfmat3", {
    form: {},
    headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(403);
});
