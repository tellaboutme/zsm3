import { expect, test } from "./fixtures.ts";

const ORIGIN = "https://www.zespolszkolmechanicznych.edu.pl";

test("news RSS lists published items with absolute links", async ({ request }) => {
  const response = await request.get("/aktualnosci/rss.xml");
  const body = await response.text();

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/rss+xml");
  expect(body).toContain('<rss version="2.0">');
  expect(body).toMatch(
    /<link>https:\/\/www\.zespolszkolmechanicznych\.edu\.pl\/aktualnosci\/\d{4}\//u,
  );
});

test("sitemap lists published pages and news but excludes search", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  const body = await response.text();

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/xml");
  expect(body).toContain("/kandydaci/zawody/technik-programista</loc>");
  expect(body).toMatch(/\/aktualnosci\/\d{4}\/[^<]+<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/u);
  expect(body).not.toContain("/szukaj</loc>");
});

test("canonical and noindex metadata follow the address", async ({ page }) => {
  await page.goto("/szukaj?q=mechanik");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${ORIGIN}/szukaj`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");

  await page.goto("/aktualnosci/strona/2");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");

  await page.goto("/aktualnosci?utm_source=mail");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${ORIGIN}/aktualnosci`,
  );

  await page.goto("/kandydaci/zawody/technik-programista");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${ORIGIN}/kandydaci/zawody/technik-programista`,
  );
});

test("pages reached with a query carry a noindex response header", async ({ request }) => {
  const indexed = await request.get("/kontakt");
  const duplicate = await request.get("/kontakt?utm_source=mail");

  expect(indexed.headers()["x-robots-tag"]).toBeUndefined();
  expect(duplicate.headers()["x-robots-tag"]).toBe("noindex, follow");
});

test("the news listing offers its feed only when unfiltered", async ({ page }) => {
  await page.goto("/aktualnosci");
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
    "href",
    "/aktualnosci/rss.xml",
  );
  await expect(page.getByRole("link", { name: "Kanał RSS aktualności" })).toBeVisible();

  await page.goto("/aktualnosci/strona/2");
  await expect(page.getByRole("link", { name: "Kanał RSS aktualności" })).toHaveCount(0);
});

test("calendar structured data only states school-year dates", async ({ page }) => {
  await page.goto("/szkola/terminarz");
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const events = schemas.filter((schema) => schema.includes('"@type":"Event"'));

  expect(events.length).toBeGreaterThan(0);
  expect(events.some((schema) => schema.includes('"startDate":"2026-09-01"'))).toBe(true);
  expect(events.every((schema) => !schema.includes('"location"'))).toBe(true);
});

test("structured data stays inert under the page CSP", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) {
      violations.push(message.text());
    }
  });

  await page.goto("/kandydaci/zawody/technik-programista");
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();

  expect(schemas.some((schema) => schema.includes('"@type":"Course"'))).toBe(true);
  expect(schemas.some((schema) => schema.includes('"@type":"BreadcrumbList"'))).toBe(true);
  expect(violations).toEqual([]);
});

test("the home page describes the school", async ({ page }) => {
  await page.goto("/");
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();

  expect(schemas.some((schema) => schema.includes('"@type":"HighSchool"'))).toBe(true);
});
