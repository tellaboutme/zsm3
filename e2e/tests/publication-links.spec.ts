import { expect, test } from "./fixtures.ts";

const managedPages = ["/kandydaci/dzien-otwarty", "/uczniowie/wychowawcy", "/zamowienia-publiczne"];
const unroutable = "/szkola/projekty/erasmus";

test("page links follow publication in navigation, search and sitemaps", async ({
  page,
  request,
}) => {
  const published = new Set<string>();
  for (const path of managedPages) {
    const response = await request.get(path);
    expect([200, 404], path).toContain(response.status());
    if (response.status() === 200) {
      published.add(path);
    }
  }
  for (const [path, status] of [
    ["/", 200],
    ["/kandydaci", 200],
    ["/mapa-strony", 200],
    ["/e-wniosek", 200],
    ["/e-wniosek/status", 200],
    ["/wzornik", 200],
    ["/nie-istnieje", 404],
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(status);
    const html = await response.text();
    for (const managed of [...managedPages, unroutable]) {
      if (!published.has(managed)) {
        expect(html, path).not.toContain(`href="${managed}"`);
      } else if (path !== "/wzornik" && path !== "/nie-istnieje") {
        expect(html, path).toContain(`href="${managed}"`);
      }
    }
  }
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Biuletyn Informacji Publicznej" })).toHaveCount(1);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  const results = await request.get("/szukaj/wyniki.json?q=otwarty");
  expect(results.status()).toBe(200);
  const search = await results.text();
  const index = await request.get("/szukaj/indeks.json");
  expect(index.status()).toBe(200);
  const entries = await index.text();
  expect((await request.get(unroutable)).status()).toBe(404);
  expect(xml).not.toContain(unroutable);
  expect(search).not.toContain(`"href":"${unroutable}"`);
  expect(entries).not.toContain(`"href":"${unroutable}"`);
  for (const path of managedPages) {
    if (published.has(path)) {
      expect(xml).toContain(path);
      expect(entries).toContain(`"href":"${path}"`);
    } else {
      expect(xml).not.toContain(path);
      expect(search).not.toContain(`"href":"${path}"`);
      expect(entries).not.toContain(`"href":"${path}"`);
    }
  }
});

test("request aliases redirect to the canonical routes with security headers", async ({
  request,
  page,
}) => {
  for (const [source, target] of [
    ["/uczniowie/e-wniosek", "/e-wniosek"],
    ["/uczniowie/e-wniosek/status", "/e-wniosek/status"],
  ] as const) {
    for (const method of ["get", "head"] as const) {
      const response = await request[method](source, { maxRedirects: 0 });
      expect(response.status()).toBe(308);
      expect(response.headers()["location"]).toBe(target);
      expect(response.headers()["content-security-policy"]).toContain("default-src 'none'");
      expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    }
  }
  await page.goto("/uczniowie/e-wniosek/status#example-token");
  await expect(page).toHaveURL(/\/e-wniosek\/status#example-token$/u);
});
