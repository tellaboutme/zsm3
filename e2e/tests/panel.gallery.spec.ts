import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";
import { ALBUM_ID, fakeGallery, fakePhoto, plainJpeg, rotatedJpeg } from "./panel-gallery-fake.ts";
import { recordSentForms, sentFile } from "./panel-gallery-forms.ts";
import { pageProblems } from "./panel-requests-fake.ts";
import { variantsFit } from "../../apps/worker/src/media/photo-variants.ts";
import { inspectWebp } from "../../apps/worker/src/media/webp-inspector.ts";

const ALBUM_PAGE = `/panel/galeria/album?id=${ALBUM_ID}`;
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function fillUpload(page: Page, file: Buffer): Promise<void> {
  await page
    .getByLabel("Zdjęcie (JPG, PNG lub WebP)")
    .setInputFiles({ name: "zdjecie.jpg", mimeType: "image/jpeg", buffer: file });
  await page.getByLabel("Opis dla osób niewidomych").fill("Uczniowie na apelu");
  await page.getByLabel(/Potwierdzam, że szkoła ma zgodę/u).check();
}

test.describe("gallery panel", () => {
  test("shows the section to gallery_editor and hides content sections", async ({ page }) => {
    await fakeGallery(page, "gallery_editor");
    await page.goto("/panel/galeria");
    const tabs = page.getByRole("navigation", { name: "Sekcje panelu" });
    await expect(tabs.getByRole("link", { name: "Galeria" })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Aktualności" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Dzień Patrona" })).toBeVisible();
  });

  test("refuses other roles", async ({ page }) => {
    await fakeGallery(page, "editor");
    await page.goto("/panel/galeria");
    await expect(page.getByRole("heading", { name: "Galeria" })).toBeHidden();
  });

  test("creates an album with a slug from its title", async ({ page }) => {
    const fake = await fakeGallery(page, "admin");
    await page.goto("/panel/galeria");
    await page.getByLabel("Tytuł").fill("Święto Szkoły");
    await page.getByRole("button", { name: "Utwórz album" }).click();
    await expect(page).toHaveURL(new RegExp(`album\\?id=${ALBUM_ID}`, "u"));
    expect(fake.sent[0]?.body).toMatchObject({ slug: "swieto-szkoly", title: "Święto Szkoły" });
  });

  test("prepares a rotated photo that the server inspector accepts", async ({
    page,
    problems,
    browserName,
  }) => {
    const fake = await fakeGallery(page, "gallery_editor");
    await recordSentForms(page);
    await page.goto(ALBUM_PAGE);
    await fillUpload(page, await rotatedJpeg(page));
    await page.getByRole("button", { name: "Dodaj zdjęcie" }).click();
    await expect(page.getByText("Dodano zdjęcie do albumu.")).toBeVisible({ timeout: 30_000 });
    expect(fake.uploads).toHaveLength(1);
    const small = inspectWebp(await sentFile(page, "small"));
    const large = inspectWebp(await sentFile(page, "large"));
    expect(small).toMatchObject({ ok: true, width: 300, height: 400 });
    expect(large).toMatchObject({ ok: true, width: 600, height: 800 });
    expect(small.ok && large.ok && variantsFit(small, large)).toBe(true);
    await expect(page.getByLabel("Opis zdjęcia 1")).toHaveValue("Opis zdjęcia 1");
    await expect(page.getByLabel(/Potwierdzam, że szkoła ma zgodę/u)).not.toBeChecked();
    expect(pageProblems(problems, browserName)).toEqual([]);
  });

  test("demands a description and the confirmation before any work", async ({ page }) => {
    const fake = await fakeGallery(page, "admin");
    await page.goto(ALBUM_PAGE);
    await page.evaluate(() => {
      document.querySelector('[data-panel="photo-form"]')?.setAttribute("novalidate", "");
    });
    const send = page.getByRole("button", { name: "Dodaj zdjęcie" });
    await send.click();
    await expect(page.getByText("Wybierz zdjęcie.")).toBeVisible();
    await page
      .getByLabel("Zdjęcie (JPG, PNG lub WebP)")
      .setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: await rotatedJpeg(page) });
    await send.click();
    await expect(page.getByText("Opisz zdjęcie dla osób niewidomych.")).toBeVisible();
    await expect(page.getByLabel("Opis dla osób niewidomych")).toBeFocused();
    await page.getByLabel("Opis dla osób niewidomych").fill("Opis");
    await send.click();
    await expect(page.getByText("Potwierdź podstawę publikacji zdjęcia.")).toBeVisible();
    expect(fake.uploads).toHaveLength(0);
  });

  test("explains a file it cannot read and a photo that is too small", async ({ page }) => {
    const fake = await fakeGallery(page, "admin");
    await page.goto(ALBUM_PAGE);
    await fillUpload(page, Buffer.from("to nie jest obraz"));
    await page.getByRole("button", { name: "Dodaj zdjęcie" }).click();
    await expect(page.getByText(/Nie udało się odczytać pliku/u)).toBeVisible();
    await fillUpload(page, await plainJpeg(page, 300, 200));
    await page.getByRole("button", { name: "Dodaj zdjęcie" }).click();
    await expect(page.getByText(/Zdjęcie jest za małe/u)).toBeVisible({ timeout: 30_000 });
    expect(fake.uploads).toHaveLength(0);
  });

  test("cancels a running upload and keeps what was typed", async ({ page }) => {
    await fakeGallery(page, "admin");
    await page.route("**/photos", async () => new Promise(() => undefined));
    await page.goto(ALBUM_PAGE);
    await fillUpload(page, await rotatedJpeg(page));
    await page.getByRole("button", { name: "Dodaj zdjęcie" }).click();
    await expect(page.getByText("Wysyłam zdjęcie…")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Anuluj" }).click();
    await expect(page.getByText("Anulowano wysyłanie.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Anuluj" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Dodaj zdjęcie" })).toBeEnabled();
    await expect(page.getByLabel("Opis dla osób niewidomych")).toHaveValue("Uczniowie na apelu");
  });

  test("names the upload problems the server reports", async ({ page }) => {
    const fake = await fakeGallery(page, "admin");
    fake.uploadStatus = 409;
    fake.uploadTitle = "Photo Upload In Progress";
    await page.goto(ALBUM_PAGE);
    await fillUpload(page, await rotatedJpeg(page));
    await page.getByRole("button", { name: "Dodaj zdjęcie" }).click();
    await expect(page.getByText(/właśnie przetwarzane/u)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Opis dla osób niewidomych")).toHaveValue("Uczniowie na apelu");
  });

  test("publishes after confirmation and reports an empty album", async ({ page }) => {
    const fake = await fakeGallery(page, "gallery_editor");
    fake.photos.push(fakePhoto(0));
    fake.album.photoCount = 1;
    await page.goto(ALBUM_PAGE);
    page.once("dialog", (dialog) => void dialog.dismiss());
    await page.getByRole("button", { name: "Opublikuj album" }).click();
    expect(fake.sent).toHaveLength(0);

    fake.publishStatus = 422;
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Opublikuj album" }).click();
    await expect(page.getByText(/Album bez zdjęć/u)).toBeVisible();

    fake.publishStatus = 200;
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Opublikuj album" }).click();
    await expect(page.getByRole("button", { name: "Ukryj album" })).toBeVisible();
    await expect(page.locator('[data-panel="album-state"]')).toContainText("Opublikowany");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  });

  test("edits a description and deletes a photo", async ({ page }) => {
    const fake = await fakeGallery(page, "admin");
    fake.photos.push(fakePhoto(0));
    fake.album.photoCount = 1;
    await page.goto(ALBUM_PAGE);
    await page.getByLabel("Opis zdjęcia 1").fill("Nowy opis");
    await page.getByRole("button", { name: "Zapisz opis zdjęcia 1" }).click();
    await expect(page.getByText("Zapisano opis.")).toBeVisible();
    expect(fake.sent.at(-1)?.body).toEqual({ alt: "Nowy opis" });
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Usuń zdjęcie 1" }).click();
    await expect(page.getByText("Usunięto zdjęcie.")).toBeVisible();
    await expect(page.getByLabel("Opis zdjęcia 1")).toHaveCount(0);
  });

  test("keeps the worker exception on the upload page only", async ({ page }) => {
    await fakeGallery(page, "admin");
    const upload = await page.goto(ALBUM_PAGE);
    const uploadPolicy = upload?.headers()["content-security-policy"] ?? "";
    expect(uploadPolicy).toContain("worker-src 'self'");
    expect(uploadPolicy).toContain("'wasm-unsafe-eval'");
    expect(uploadPolicy).not.toContain("blob:");
    expect(uploadPolicy).not.toContain("'unsafe-eval'");
    expect(uploadPolicy).not.toContain("'unsafe-inline'");
    const list = await page.goto("/panel/galeria");
    const listPolicy = list?.headers()["content-security-policy"] ?? "";
    expect(listPolicy).not.toContain("wasm-unsafe-eval");
    expect(listPolicy).not.toContain("worker-src");
  });

  test("has no axe violations and no horizontal scroll on either page", async ({ page }) => {
    const fake = await fakeGallery(page, "admin");
    fake.photos.push(fakePhoto(0));
    for (const path of ["/panel/galeria", ALBUM_PAGE]) {
      await page.goto(path);
      await expect(page.locator('[data-panel="app"]')).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Album");
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });
});
