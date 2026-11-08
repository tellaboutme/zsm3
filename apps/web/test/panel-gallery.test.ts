import { describe, it } from "vitest";

import { photoCountPhrase } from "../src/lib/gallery.ts";
import {
  albumHref,
  albumIdFrom,
  albumStatePhrase,
  galleryProblemPhrase,
  photoFailurePhrase,
  photoRemovedPhrase,
  removalHidesAlbum,
  removePhotoQuestion,
  schoolYearChoices,
  schoolYearOf,
  sourceFilePhrase,
  uploadPercent,
} from "../src/lib/panel/gallery.ts";
import { canEditContent, canManageGallery } from "../src/lib/panel/gate.ts";
import { MAX_SOURCE_BYTES } from "../src/lib/panel/photo-sizing.ts";

const ID = "018f0000-0000-7000-8000-000000000000";

describe("gallery roles", () => {
  it("opens the gallery to admin and gallery_editor only", ({ expect }) => {
    expect(["admin", "gallery_editor", "editor", "secretariat", ""].map(canManageGallery)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(canEditContent("gallery_editor")).toBe(false);
  });
});

describe("galleryProblemPhrase", () => {
  it("explains each named problem", ({ expect }) => {
    for (const [title, phrase] of [
      [
        "Album Slug Taken",
        "W tym roku szkolnym istnieje już album o takim adresie. Zmień tytuł lub adres.",
      ],
      [
        "Album Has No Photos",
        "Album bez zdjęć nie może zostać opublikowany. Dodaj co najmniej jedno.",
      ],
      ["Album Is Full", "Album ma już 1000 zdjęć. Utwórz kolejny album."],
      ["Publication Status Unchanged", "Stan publikacji już się zmienił. Odśwież stronę."],
      [
        "Photo In Another Album",
        "To zdjęcie jest już w innym albumie i nie można go dodać drugi raz.",
      ],
      [
        "Photo Upload In Progress",
        "To zdjęcie jest właśnie przetwarzane. Spróbuj ponownie za kilka minut.",
      ],
      ["Invalid Image", "Serwer odrzucił przygotowane zdjęcie. Wybierz inny plik."],
    ] as const) {
      expect(galleryProblemPhrase(422, { title })).toBe(phrase);
    }
  });

  it("states the photo limit instead of the document limit", ({ expect }) => {
    expect(galleryProblemPhrase(413, undefined)).toBe(
      "Przygotowane zdjęcie przekracza limit 1.5 MB.",
    );
  });

  it("falls back to the status phrase", ({ expect }) => {
    expect(galleryProblemPhrase(403, { title: "Other" })).toBe("Brak uprawnień do tej czynności.");
    expect(galleryProblemPhrase(403, undefined)).toBe("Brak uprawnień do tej czynności.");
  });

  it("reports a lost connection as a connection problem", ({ expect }) => {
    expect(galleryProblemPhrase(0, undefined)).toBe(
      "Brak połączenia z serwerem. Spróbuj ponownie.",
    );
    expect(galleryProblemPhrase(418, undefined)).toBe(
      "Nieoczekiwana odpowiedź serwera. Spróbuj ponownie.",
    );
  });
});

describe("photo phrases", () => {
  it("names each preparation failure", ({ expect }) => {
    expect(photoFailurePhrase("unreadable")).toBe(
      "Nie udało się odczytać pliku. Wybierz zdjęcie JPG, PNG lub WebP.",
    );
    expect(photoFailurePhrase("too-small")).toBe(
      "Zdjęcie jest za małe. Dłuższy bok musi mieć co najmniej 400 pikseli.",
    );
    expect(photoFailurePhrase("too-heavy")).toBe(
      "Nie udało się zmieścić zdjęcia w limicie 1.5 MB. Wybierz inny plik.",
    );
    expect(photoFailurePhrase("unavailable")).toBe(
      "Ta przeglądarka nie może teraz przygotować zdjęcia. Odśwież stronę albo użyj innej przeglądarki.",
    );
  });

  it("checks the source file size", ({ expect }) => {
    expect(sourceFilePhrase(0)).toBe("Plik jest pusty.");
    expect(sourceFilePhrase(1)).toBeUndefined();
    expect(sourceFilePhrase(MAX_SOURCE_BYTES)).toBeUndefined();
    expect(sourceFilePhrase(MAX_SOURCE_BYTES + 1)).toBe("Plik przekracza limit 40 MB.");
  });

  it("declines the number of photos in Polish", ({ expect }) => {
    expect([0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 112, 122].map(photoCountPhrase)).toEqual([
      "0 zdjęć",
      "1 zdjęcie",
      "2 zdjęcia",
      "4 zdjęcia",
      "5 zdjęć",
      "11 zdjęć",
      "12 zdjęć",
      "14 zdjęć",
      "21 zdjęć",
      "22 zdjęcia",
      "25 zdjęć",
      "112 zdjęć",
      "122 zdjęcia",
    ]);
  });

  it("names the album state", ({ expect }) => {
    expect(albumStatePhrase(null)).toBe("Szkic");
    expect(albumStatePhrase("2026-11-04T10:00:00Z")).toBe("Opublikowany");
  });
});

describe("school years", () => {
  it("changes in August", ({ expect }) => {
    expect(schoolYearOf(new Date("2026-07-31T12:00:00Z"))).toBe("2025/2026");
    expect(schoolYearOf(new Date("2026-08-01T12:00:00Z"))).toBe("2026/2027");
  });

  it("lists the archive's fourteen years, newest first", ({ expect }) => {
    const years = schoolYearChoices(new Date("2026-11-04T12:00:00Z"));
    expect(years).toHaveLength(14);
    expect(years[0]).toBe("2026/2027");
    expect(years[1]).toBe("2025/2026");
    expect(years.at(-1)).toBe("2013/2014");
  });

  it("keeps the oldest archive year when a new school year starts", ({ expect }) => {
    const years = schoolYearChoices(new Date("2027-08-01T12:00:00Z"));
    expect(years).toHaveLength(15);
    expect(years[0]).toBe("2027/2028");
    expect(years.at(-1)).toBe("2013/2014");
  });

  it("still offers the oldest archive year when the clock is years behind", ({ expect }) => {
    expect(schoolYearChoices(new Date("2000-03-01T12:00:00Z"))).toEqual(["2013/2014"]);
    expect(schoolYearChoices(new Date("2014-03-01T12:00:00Z"))).toEqual(["2013/2014"]);
  });
});

describe("removing a photo", () => {
  const PUBLISHED = "2026-11-04T12:00:00.000Z";

  it("hides only a published album losing its last photo", ({ expect }) => {
    expect(removalHidesAlbum(PUBLISHED, 1)).toBe(true);
    expect(removalHidesAlbum(PUBLISHED, 2)).toBe(false);
    expect(removalHidesAlbum(null, 1)).toBe(false);
  });

  it("warns before the album disappears", ({ expect }) => {
    expect(removePhotoQuestion("Apel", true)).toBe(
      "Usunąć to zdjęcie z albumu? To ostatnie zdjęcie, więc album zniknie ze strony do czasu ponownej publikacji.\n\nApel",
    );
    expect(removePhotoQuestion("Apel", false)).toBe(
      "Usunąć to zdjęcie z albumu? Zniknie ze strony od razu.\n\nApel",
    );
  });

  it("reports whether the album was hidden", ({ expect }) => {
    expect(photoRemovedPhrase(true)).toBe("Usunięto zdjęcie. Album bez zdjęć został ukryty.");
    expect(photoRemovedPhrase(false)).toBe("Usunięto zdjęcie.");
  });
});

describe("album links", () => {
  it("round-trips the id through the page address", ({ expect }) => {
    expect(albumHref(ID)).toBe(`/panel/galeria/album?id=${ID}`);
    expect(albumIdFrom(`?id=${ID}`)).toBe(ID);
  });

  it("refuses anything but a uuid", ({ expect }) => {
    expect(albumIdFrom("?id=abc")).toBeUndefined();
    expect(albumIdFrom("")).toBeUndefined();
  });
});

describe("uploadPercent", () => {
  it("rounds progress and survives an unknown total", ({ expect }) => {
    expect(uploadPercent(1, 3)).toBe(33);
    expect(uploadPercent(5, 5)).toBe(100);
    expect(uploadPercent(5, 0)).toBe(0);
  });
});
