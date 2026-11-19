import { expect, test } from "./fixtures.ts";
import { fakeFeatured } from "./panel-featured-fake.ts";
import { ALBUM_ID, fakeGallery, fakePhoto } from "./panel-gallery-fake.ts";

test.describe("featured photos in the gallery panel", () => {
  test("features a photo of an album for a chosen place", async ({ page }) => {
    const fake = await fakeGallery(page, "gallery_editor");
    fake.photos.push(fakePhoto(0));
    const sent = await fakeFeatured(page);
    await page.goto(`/panel/galeria/album?id=${ALBUM_ID}`);

    await page.getByRole("button", { name: "Wyróżnij zdjęcie 1" }).click();
    await expect(page.getByText("Wybierz miejsce, w którym ma się pojawić zdjęcie.")).toBeVisible();
    await page.getByLabel("Wyróżnij zdjęcie 1 jako").selectOption("film");
    await page.getByRole("button", { name: "Wyróżnij zdjęcie 1" }).click();

    await expect(page.getByText("Zdjęcie jest teraz wyróżnione: Film o szkole.")).toBeVisible();
    expect(sent).toEqual([
      { method: "PUT", path: "/api/panel/featured/film", body: { photoId: fakePhoto(0)["id"] } },
    ]);
  });

  test("lists featured photos and removes one", async ({ page }) => {
    await fakeGallery(page, "admin");
    const sent = await fakeFeatured(page, true);
    await page.goto("/panel/galeria");

    await expect(
      page.getByText(
        "Strona główna: Budynek szkoły od strony boiska · album „Dzień Patrona” · widoczne na stronie",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Usuń wyróżnienie: Strona główna" }).click();

    await expect(page.getByText("Usunięto wyróżnienie: Strona główna.")).toBeVisible();
    expect(sent.map(({ method, path }) => [method, path])).toEqual([
      ["DELETE", "/api/panel/featured/home"],
    ]);
  });
});
