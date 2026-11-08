import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

const YEAR_PATH = "/szkola/galeria/2025-2026";
const ALBUM_PATH = `${YEAR_PATH}/przykladowy-album`;
const WIDTHS = [360, 768, 1280, 1920] as const;

async function expectAccessible(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
}

async function brokenHeadingWords(page: Page): Promise<readonly string[]> {
  return page.locator("h1").evaluate((heading) => {
    const text = heading.firstChild;
    const content = heading.textContent;
    const broken: string[] = [];
    let start = 0;
    for (const word of content.split(" ")) {
      const range = document.createRange();
      range.setStart(text ?? heading, start);
      range.setEnd(text ?? heading, start + word.length);
      if (new Set([...range.getClientRects()].map((rect) => rect.top)).size > 1) {
        broken.push(word);
      }
      start += word.length + 1;
    }
    return broken;
  });
}

async function overflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function stageScroll(page: Page): Promise<readonly number[]> {
  return page
    .locator("[data-lightbox-stage]")
    .evaluate((stage) => [stage.scrollLeft, stage.scrollTop]);
}

async function expectDragPans(page: Page): Promise<void> {
  const stage = page.locator("[data-lightbox-stage]");
  const room = await stage.evaluate(
    (element) =>
      element.scrollWidth - element.clientWidth + element.scrollHeight - element.clientHeight,
  );
  expect(room).toBeGreaterThan(0);
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
  const before = await stageScroll(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 80, y - 40, { steps: 5 });
  await page.mouse.up();
  expect(await stageScroll(page)).not.toEqual(before);
  await expect(page.getByRole("button", { name: "Pomniejsz" })).toBeVisible();
}

test("visitors walk from years through albums to photos", async ({ page, problems }) => {
  await page.goto("/szkola/galeria");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await page.getByRole("link", { name: "2025/2026" }).click();
  await page.waitForURL(YEAR_PATH, { waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rok szkolny 2025/2026");
  await expect(page.getByText("Szkic albumu")).toHaveCount(0);
  await page.getByRole("link", { name: "Przykładowy album" }).click();
  await page.waitForURL(ALBUM_PATH, { waitUntil: "load" });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`${ALBUM_PATH}$`, "u"),
  );
  await expect(page.locator("a[data-gallery-photo]")).toHaveCount(5);
  await expectAccessible(page);
  expect(problems).toEqual([]);
});

test("the album fits every width in both themes", async ({ page }) => {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(ALBUM_PATH);
      expect(await overflow(page), `${scheme} ${String(width)}`).toBe(0);
    }
  }
  await expectAccessible(page);
});

test("gallery headings never break inside a word", async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/szkola/galeria", YEAR_PATH, "/szkola/galeria/2019-2020", ALBUM_PATH]) {
      await page.goto(path);
      expect(await brokenHeadingWords(page), `${path} ${String(width)}`).toEqual([]);
    }
  }
});

test("the lightbox moves, zooms, announces and returns focus", async ({ page, problems }) => {
  await page.goto(ALBUM_PATH);
  const first = page.locator("a[data-gallery-photo]").first();
  await first.click();
  const dialog = page.getByRole("dialog", { name: "Podgląd zdjęcia" });
  const place = dialog.locator("[data-lightbox-position]");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Zamknij" })).toBeFocused();
  await expect(place).toHaveText("Zdjęcie 1 z 5");
  await expect(dialog.getByRole("button", { name: "Poprzednie" })).toBeDisabled();
  const image = dialog.locator("img");
  await expect
    .poll(async () => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBe(1200);
  await expectAccessible(page);

  await page.keyboard.press("ArrowRight");
  await expect(place).toHaveText("Zdjęcie 2 z 5");
  await expect(dialog.getByRole("status")).toContainText("Zdjęcie 2 z 5.");
  await page.keyboard.press("ArrowLeft");
  await expect(place).toHaveText("Zdjęcie 1 z 5");

  const zoom = dialog.getByRole("button", { name: "Powiększ" });
  await zoom.click();
  await expect(dialog.getByRole("button", { name: "Pomniejsz" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(dialog.locator("[data-lightbox-stage]")).toHaveAttribute("tabindex", "0");
  await expectDragPans(page);
  await page.keyboard.press("ArrowRight");
  await expect(place).toHaveText("Zdjęcie 1 z 5");
  await dialog.getByRole("button", { name: "Pomniejsz" }).click();

  for (const position of [2, 3, 4, 5]) {
    await dialog.getByRole("button", { name: "Następne" }).click();
    await expect(place).toHaveText(`Zdjęcie ${String(position)} z 5`);
  }
  await expect(dialog.getByRole("button", { name: "Poprzednie" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(first).toBeFocused();
  expect(problems).toEqual([]);
});

test("without JavaScript a thumbnail still opens the large photo", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: baseURL ?? "" });
  const page = await context.newPage();
  await page.goto(ALBUM_PATH);
  const href = await page.locator("a[data-gallery-photo]").first().getAttribute("href");
  expect(href).toMatch(/^\/media\/g\/[0-9a-f]{64}-l\.webp$/u);
  await context.close();
});

test("published photos are served with safe headers, drafts are not", async ({ page, request }) => {
  await page.goto(ALBUM_PATH);
  const href = (await page.locator("a[data-gallery-photo]").first().getAttribute("href")) ?? "";
  const photo = await request.get(href);
  expect(photo.status()).toBe(200);
  expect(photo.headers()["content-type"]).toBe("image/webp");
  expect(photo.headers()["cache-control"]).toBe("no-store");
  expect(photo.headers()["x-content-type-options"]).toBe("nosniff");
  expect(photo.headers()["cross-origin-resource-policy"]).toBe("same-origin");

  expect((await request.get(`${YEAR_PATH}/szkic-albumu`)).status()).toBe(404);
  expect((await request.get(`/media/g/${"a".repeat(64)}-l.webp`)).status()).toBe(404);
  const years = await request.get("/api/gallery/years");
  expect(years.headers()["cache-control"]).toBe("public, max-age=60");
  expect(JSON.stringify(await years.json())).toContain("2025/2026");
});
