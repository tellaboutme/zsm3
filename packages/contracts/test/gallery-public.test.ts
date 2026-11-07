import { describe, it } from "vitest";

import {
  GALLERY_PATH,
  galleryAlbumPath,
  galleryYearPath,
  MAX_LISTED_YEARS,
  photoFileHash,
  photoPath,
  publicAlbumListSchema,
  publicAlbumViewSchema,
  publicYearListSchema,
  schoolYearFromSlug,
  yearSlug,
} from "../src/gallery-public.ts";

const SHA = "a".repeat(64);
const ID = "01890a5d-ac96-7abc-8def-0123456789ab";
const ALBUM = {
  id: ID,
  schoolYear: "2025/2026",
  slug: "dzien-patrona",
  title: "Dzień patrona",
  description: "",
  photoCount: 1,
  coverSha256: SHA,
};
const PHOTO = { id: ID, width: 1600, height: 900, alt: "Apel", sha256: SHA };

describe("public gallery addresses", () => {
  it("turns school years into path segments and back", ({ expect }) => {
    expect(GALLERY_PATH).toBe("/szkola/galeria");
    expect(yearSlug("2025/2026")).toBe("2025-2026");
    expect(schoolYearFromSlug("2025-2026")).toBe("2025/2026");
    expect(galleryYearPath("2025/2026")).toBe("/szkola/galeria/2025-2026");
    expect(galleryAlbumPath({ schoolYear: "2025/2026", slug: "a" })).toBe(
      "/szkola/galeria/2025-2026/a",
    );
  });

  it.for([
    "2025-2027",
    "2025/2026",
    "x2025-2026",
    "2025-2026x",
    "2025",
    "abcd-efgh",
    "2025-2026-2027",
    "../..",
    "",
  ])("refuses the year segment %j", (slug, { expect }) => {
    expect(schoolYearFromSlug(slug)).toBeUndefined();
  });

  it("builds photo addresses and reads the hash back only from exact file names", ({ expect }) => {
    expect(photoPath(SHA, "s")).toBe(`/media/g/${SHA}-s.webp`);
    expect(photoFileHash(`${SHA}-s.webp`)).toBe(SHA);
    expect(photoFileHash(`${SHA}-l.webp`)).toBe(SHA);
    for (const name of [
      `${SHA}-x.webp`,
      `${SHA}-s.png`,
      `x${SHA}-s.webp`,
      `${SHA}-s.webp.exe`,
      `${"A".repeat(64)}-s.webp`,
      `${"a".repeat(63)}-s.webp`,
      "..%2f-s.webp",
    ]) {
      expect(photoFileHash(name), name).toBeUndefined();
    }
  });
});

describe("public gallery responses", () => {
  it("accepts the published shape", ({ expect }) => {
    expect(
      publicYearListSchema.safeParse({ items: [{ schoolYear: "2025/2026", albumCount: 1 }] })
        .success,
    ).toBe(true);
    expect(publicAlbumListSchema.safeParse({ items: [ALBUM] }).success).toBe(true);
    expect(publicAlbumViewSchema.safeParse({ item: ALBUM, photos: [PHOTO] }).success).toBe(true);
  });

  it("accepts larger counts and any size up to the limit", ({ expect }) => {
    expect(
      publicYearListSchema.safeParse({ items: [{ schoolYear: "2025/2026", albumCount: 2 }] })
        .success,
    ).toBe(true);
    expect(publicAlbumListSchema.safeParse({ items: [{ ...ALBUM, photoCount: 2 }] }).success).toBe(
      true,
    );
    expect(
      publicAlbumViewSchema.safeParse({ item: ALBUM, photos: [{ ...PHOTO, width: 800 }] }).success,
    ).toBe(true);
  });

  it("refuses staff fields, empty albums and oversized lists", ({ expect }) => {
    expect(
      publicAlbumViewSchema.safeParse({
        item: ALBUM,
        photos: [{ ...PHOTO, consentBy: "staff@zsm3.test" }],
      }).success,
    ).toBe(false);
    expect(publicAlbumViewSchema.safeParse({ item: ALBUM, photos: [] }).success).toBe(false);
    expect(
      publicAlbumListSchema.safeParse({ items: [{ ...ALBUM, publishedAt: "x" }] }).success,
    ).toBe(false);
    const year = { schoolYear: "2025/2026", albumCount: 1 };
    expect(
      publicYearListSchema.safeParse({
        items: Array.from({ length: MAX_LISTED_YEARS + 1 }, () => year),
      }).success,
    ).toBe(false);
  });
});
