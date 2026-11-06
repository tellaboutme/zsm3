import { describe, it } from "vitest";

import {
  albumInputSchema,
  albumPublicationSchema,
  LARGE_LONG_EDGE,
  MAX_ALBUM_PHOTOS,
  MAX_LISTED_ALBUMS,
  MAX_PHOTO_VARIANT_BYTES,
  panelAlbumListQuerySchema,
  panelAlbumListSchema,
  panelAlbumSchema,
  panelAlbumViewSchema,
  panelPhotoSchema,
  panelPhotoUploadSchema,
  photoAltSchema,
  photoFieldsSchema,
  photoKey,
  photoVariantSchema,
  schoolYearSchema,
  SMALL_LONG_EDGE,
} from "../src/gallery.ts";

const SHA = "a".repeat(64);
const ID = "01890a5d-ac96-7abc-8def-0123456789ab";
const INPUT = {
  schoolYear: "2026/2027",
  slug: "dzien-patrona",
  title: "Dzień patrona",
  description: "Opis",
};
const ALBUM = {
  ...INPUT,
  id: ID,
  publishedAt: null,
  photoCount: 0,
  updatedAt: "2026-11-02T08:00:00.000Z",
};
const PHOTO = {
  id: ID,
  albumId: ID,
  position: 0,
  width: 1600,
  height: 900,
  alt: "Uczniowie",
  sha256: SHA,
  consentBy: "galeria@zsm3.test",
  consentAt: "2026-11-02T08:00:00.000Z",
  createdAt: "2026-11-02T08:00:00.000Z",
};

it("pins the limits from the architecture", ({ expect }) => {
  expect(MAX_PHOTO_VARIANT_BYTES).toBe(1_500_000);
  expect(SMALL_LONG_EDGE).toBe(400);
  expect(LARGE_LONG_EDGE).toBe(1600);
  expect(MAX_LISTED_ALBUMS).toBe(500);
  expect(MAX_ALBUM_PHOTOS).toBe(1000);
});

describe("school years", () => {
  it("accepts two consecutive years", ({ expect }) => {
    expect(schoolYearSchema.parse("2026/2027")).toBe("2026/2027");
  });

  it("refuses anything else", ({ expect }) => {
    for (const year of [
      "2026/2028",
      "2026/2026",
      "2026-2027",
      "26/27",
      " 2026/2027",
      "2026/2027 ",
      "a2026/2027",
    ]) {
      expect(schoolYearSchema.safeParse(year).success, year).toBe(false);
    }
  });

  it("explains a gap between the years", ({ expect }) => {
    const parsed = schoolYearSchema.safeParse("2026/2028");
    expect(parsed.error?.issues[0]?.message).toBe("A school year spans two consecutive years");
  });
});

describe("album input", () => {
  it("trims text and rejects extra fields", ({ expect }) => {
    expect(albumInputSchema.parse({ ...INPUT, title: " Tytuł ", description: " Opis " })).toEqual({
      ...INPUT,
      title: "Tytuł",
      description: "Opis",
    });
    expect(albumInputSchema.safeParse({ ...INPUT, extra: 1 }).success).toBe(false);
  });

  it("limits each field at its boundary", ({ expect }) => {
    const valid = (patch: object): boolean =>
      albumInputSchema.safeParse({ ...INPUT, ...patch }).success;
    expect(valid({ title: "x".repeat(200) })).toBe(true);
    expect(valid({ title: "x".repeat(201) })).toBe(false);
    expect(valid({ title: "  " })).toBe(false);
    expect(valid({ description: "" })).toBe(true);
    expect(valid({ description: "x".repeat(2000) })).toBe(true);
    expect(valid({ description: "x".repeat(2001) })).toBe(false);
    expect(valid({ slug: "Duze-Litery" })).toBe(false);
    expect(valid({ schoolYear: "2026" })).toBe(false);
  });

  it("knows only two publication actions", ({ expect }) => {
    expect(albumPublicationSchema.parse({ action: "publish" }).action).toBe("publish");
    expect(albumPublicationSchema.parse({ action: "unpublish" }).action).toBe("unpublish");
    expect(albumPublicationSchema.safeParse({ action: "hide" }).success).toBe(false);
    expect(albumPublicationSchema.safeParse({ action: "publish", x: 1 }).success).toBe(false);
  });
});

describe("panel albums", () => {
  it("reads a full album and refuses broken ones", ({ expect }) => {
    expect(panelAlbumSchema.parse(ALBUM)).toEqual(ALBUM);
    expect(panelAlbumSchema.parse({ ...ALBUM, publishedAt: "2026-11-02" }).publishedAt).toBe(
      "2026-11-02",
    );
    expect(panelAlbumSchema.safeParse({ ...ALBUM, id: "x" }).success).toBe(false);
    expect(panelAlbumSchema.safeParse({ ...ALBUM, photoCount: -1 }).success).toBe(false);
    expect(panelAlbumSchema.safeParse({ ...ALBUM, photoCount: 0.5 }).success).toBe(false);
    expect(panelAlbumSchema.safeParse({ ...ALBUM, updatedAt: "" }).success).toBe(false);
  });

  it("filters only by a valid year", ({ expect }) => {
    expect(panelAlbumListQuerySchema.parse({})).toEqual({});
    expect(panelAlbumListQuerySchema.parse({ schoolYear: "2026/2027" }).schoolYear).toBe(
      "2026/2027",
    );
    expect(panelAlbumListQuerySchema.safeParse({ schoolYear: "2026" }).success).toBe(false);
    expect(panelAlbumListQuerySchema.safeParse({ other: "1" }).success).toBe(false);
  });

  it("limits the album list and view", ({ expect }) => {
    const albums = (count: number): unknown => ({ items: new Array(count).fill(ALBUM) });
    expect(panelAlbumListSchema.safeParse(albums(500)).success).toBe(true);
    expect(panelAlbumListSchema.safeParse(albums(501)).success).toBe(false);
    const view = (count: number): unknown => ({
      item: ALBUM,
      photos: new Array(count).fill(PHOTO),
    });
    expect(panelAlbumViewSchema.safeParse(view(1000)).success).toBe(true);
    expect(panelAlbumViewSchema.safeParse(view(1001)).success).toBe(false);
  });
});

describe("photos", () => {
  it("derives both object keys from the hash", ({ expect }) => {
    expect(photoKey(SHA, "s")).toBe(`g/${SHA}-s.webp`);
    expect(photoKey(SHA, "l")).toBe(`g/${SHA}-l.webp`);
    expect(photoVariantSchema.options).toEqual(["s", "l"]);
  });

  it("requires explicit consent and alt text", ({ expect }) => {
    expect(photoFieldsSchema.parse({ alt: " Opis ", consent: "true" })).toEqual({
      alt: "Opis",
      consent: "true",
    });
    expect(photoFieldsSchema.safeParse({ alt: "Opis", consent: "false" }).success).toBe(false);
    expect(photoFieldsSchema.safeParse({ alt: "Opis" }).success).toBe(false);
    expect(photoFieldsSchema.safeParse({ alt: "x".repeat(300), consent: "true" }).success).toBe(
      true,
    );
    expect(photoFieldsSchema.safeParse({ alt: "x".repeat(301), consent: "true" }).success).toBe(
      false,
    );
    expect(photoFieldsSchema.safeParse({ alt: "  ", consent: "true" }).success).toBe(false);
    expect(photoAltSchema.parse({ alt: " Opis " }).alt).toBe("Opis");
    expect(photoAltSchema.safeParse({ alt: "x".repeat(301) }).success).toBe(false);
    expect(photoAltSchema.safeParse({ alt: "" }).success).toBe(false);
    expect(photoAltSchema.safeParse({ alt: "Opis", x: 1 }).success).toBe(false);
  });

  it("reads a stored photo and refuses broken ones", ({ expect }) => {
    expect(panelPhotoSchema.parse(PHOTO)).toEqual(PHOTO);
    expect(panelPhotoUploadSchema.parse({ item: PHOTO, duplicate: true })).toEqual({
      item: PHOTO,
      duplicate: true,
    });
    for (const patch of [
      { position: -1 },
      { width: 0 },
      { width: 1601 },
      { height: 0 },
      { height: 1601 },
      { alt: "" },
      { alt: "x".repeat(301) },
      { sha256: "x" },
      { consentBy: "" },
      { consentAt: "" },
      { createdAt: "" },
      { extra: 1 },
    ]) {
      expect(
        panelPhotoSchema.safeParse({ ...PHOTO, ...patch }).success,
        JSON.stringify(patch),
      ).toBe(false);
    }
  });
});
