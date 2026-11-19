import { describe, expect, it } from "vitest";

import {
  featuredClearedPhrase,
  featuredCountPhrase,
  featuredPath,
  featuredRowText,
  featuredSetPhrase,
} from "../src/lib/panel/featured.ts";

const ITEM = {
  slot: "kandydaci",
  width: 1600,
  height: 900,
  alt: "Pracownia druku 3D",
  sha256: "a".repeat(64),
  photoId: "00000000-0000-4000-8000-000000000001",
  albumId: "00000000-0000-4000-8000-000000000002",
  albumTitle: "Szkoła w obiektywie",
  published: true,
  updatedAt: "2026-11-19T10:00:00.000Z",
} as const;

describe("featured photo phrases", () => {
  it("builds the API path of a slot", () => {
    expect(featuredPath("home")).toBe("/api/panel/featured/home");
  });

  it("names the slot after setting and clearing it", () => {
    expect(featuredSetPhrase("film", true)).toBe("Zdjęcie jest teraz wyróżnione: Film o szkole.");
    expect(featuredSetPhrase("home", false)).toBe(
      "Zdjęcie jest teraz wyróżnione: Strona główna. Odwiedzający zobaczą je dopiero po opublikowaniu albumu.",
    );
    expect(featuredClearedPhrase("szkola")).toBe("Usunięto wyróżnienie: Szkoła.");
  });

  it("describes a featured photo and whether visitors can see it", () => {
    expect(featuredRowText(ITEM)).toBe(
      "Kandydaci: Pracownia druku 3D · album „Szkoła w obiektywie” · widoczne na stronie",
    );
    expect(featuredRowText({ ...ITEM, published: false })).toBe(
      "Kandydaci: Pracownia druku 3D · album „Szkoła w obiektywie” · album nieopublikowany, zdjęcie niewidoczne",
    );
  });

  it("counts featured photos", () => {
    expect(featuredCountPhrase(0)).toBe("Brak wyróżnionych zdjęć. Wyróżnij zdjęcie w albumie.");
    expect(featuredCountPhrase(2)).toBe("Wyróżnionych zdjęć: 2.");
  });
});
