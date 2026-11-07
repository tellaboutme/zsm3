import { z } from "zod";

import { slugSchema } from "./content.ts";
import { LARGE_LONG_EDGE } from "./gallery-limits.ts";
import type { photoVariantSchema } from "./gallery.ts";
import { MAX_ALBUM_PHOTOS, MAX_LISTED_ALBUMS, photoKey, schoolYearSchema } from "./gallery.ts";
import { sha256Schema } from "./media.ts";

export const GALLERY_PATH = "/szkola/galeria";
export const MAX_LISTED_YEARS = 100;

const PHOTO_FILE = /^(?<sha256>[0-9a-f]{64})-[sl]\.webp$/u;

export const publicYearSchema = z.strictObject({
  schoolYear: schoolYearSchema,
  albumCount: z.int().min(1),
});

export const publicAlbumSchema = z.strictObject({
  id: z.uuid(),
  schoolYear: schoolYearSchema,
  slug: slugSchema,
  title: z.string().min(1),
  description: z.string(),
  photoCount: z.int().min(1).max(MAX_ALBUM_PHOTOS),
  coverSha256: sha256Schema,
});

export const publicPhotoSchema = z.strictObject({
  id: z.uuid(),
  width: z.int().min(1).max(LARGE_LONG_EDGE),
  height: z.int().min(1).max(LARGE_LONG_EDGE),
  alt: z.string().min(1),
  sha256: sha256Schema,
});

export const publicYearListSchema = z.strictObject({
  items: z.array(publicYearSchema).max(MAX_LISTED_YEARS),
});

export const publicAlbumListSchema = z.strictObject({
  items: z.array(publicAlbumSchema).max(MAX_LISTED_ALBUMS),
});

export const publicAlbumViewSchema = z.strictObject({
  item: publicAlbumSchema,
  photos: z.array(publicPhotoSchema).min(1).max(MAX_ALBUM_PHOTOS),
});

export type PublicYear = z.infer<typeof publicYearSchema>;
export type PublicAlbum = z.infer<typeof publicAlbumSchema>;
export type PublicPhoto = z.infer<typeof publicPhotoSchema>;
export type PublicAlbumView = z.infer<typeof publicAlbumViewSchema>;

export function yearSlug(schoolYear: string): string {
  return schoolYear.replace("/", "-");
}

export function schoolYearFromSlug(slug: string): string | undefined {
  const parsed = schoolYearSchema.safeParse(slug.replace("-", "/"));
  return parsed.success && !slug.includes("/") ? parsed.data : undefined;
}

export function galleryYearPath(schoolYear: string): string {
  return `${GALLERY_PATH}/${yearSlug(schoolYear)}`;
}

export function galleryAlbumPath(album: { schoolYear: string; slug: string }): string {
  return `${galleryYearPath(album.schoolYear)}/${album.slug}`;
}

export function photoPath(sha256: string, variant: z.infer<typeof photoVariantSchema>): string {
  return `/media/${photoKey(sha256, variant)}`;
}

export function photoFileHash(name: string): string | undefined {
  return PHOTO_FILE.exec(name)?.groups?.["sha256"];
}
