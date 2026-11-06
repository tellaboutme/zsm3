import { expect, test } from "./fixtures.ts";
import { ALBUM_ID, fakeGallery, fakePhoto } from "./panel-gallery-fake.ts";

const ALBUM_PAGE = `/panel/galeria/album?id=${ALBUM_ID}`;

test.describe("gallery album page", () => {
  test("keeps unsaved text when a photo is removed", async ({ page }) => {
    const fake = await fakeGallery(page, "admin");
    fake.photos.push(fakePhoto(0), fakePhoto(1));
    fake.album.photoCount = 2;
    await page.goto(ALBUM_PAGE);
    await page.getByLabel("Tytuł").fill("Tytuł w trakcie pisania");
    await page.getByLabel("Opis zdjęcia 1").fill("Opis w trakcie pisania");
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Usuń zdjęcie 2" }).click();
    await expect(page.getByText("Usunięto zdjęcie.")).toBeVisible();
    await expect(page.getByLabel("Opis zdjęcia 2")).toHaveCount(0);
    await expect(page.getByLabel("Tytuł")).toHaveValue("Tytuł w trakcie pisania");
    await expect(page.getByLabel("Opis zdjęcia 1")).toHaveValue("Opis w trakcie pisania");
  });

  test("warns that removing the last photo hides a published album", async ({ page }) => {
    const fake = await fakeGallery(page, "admin");
    fake.photos.push(fakePhoto(0));
    fake.album.photoCount = 1;
    fake.album.publishedAt = "2026-11-04T12:00:00.000Z";
    await page.goto(ALBUM_PAGE);
    let question = "";
    page.once("dialog", (dialog) => {
      question = dialog.message();
      void dialog.accept();
    });
    await page.getByRole("button", { name: "Usuń zdjęcie 1" }).click();
    await expect(page.getByText("Album bez zdjęć został ukryty.")).toBeVisible();
    expect(question).toContain("To ostatnie zdjęcie");
  });

  test("keeps an album from a year outside the list editable", async ({ page }) => {
    const fake = await fakeGallery(page, "admin");
    fake.album.schoolYear = "2010/2011";
    await page.goto(ALBUM_PAGE);
    await expect(page.getByLabel("Rok szkolny")).toHaveValue("2010/2011");
  });

  test("offers no album controls without an album id", async ({ page }) => {
    await fakeGallery(page, "admin");
    await page.goto("/panel/galeria/album");
    await expect(page.getByText("Nie znaleziono albumu. Wróć do listy.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Zapisz album" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Dodaj zdjęcie" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Usuń album" })).toHaveCount(0);
  });
});
