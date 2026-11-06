import { z } from "zod";

import { slugSchema } from "./content.ts";
import { LARGE_LONG_EDGE } from "./gallery-limits.ts";
import { sha256Schema } from "./media.ts";

export { LARGE_LONG_EDGE, MAX_PHOTO_VARIANT_BYTES, SMALL_LONG_EDGE } from "./gallery-limits.ts";
export const MAX_LISTED_ALBUMS = 500;
export const MAX_ALBUM_PHOTOS = 1000;

export const GALLERY_ROUTE_NAMES = [
  "albums.list",
  "albums.get",
  "albums.create",
  "albums.update",
  "albums.publish",
  "albums.delete",
  "photos.upload",
  "photos.update",
  "photos.delete",
] as const;

const line = (max: number): z.ZodString => z.string().trim().min(1).max(max);

export const schoolYearSchema = z
  .string()
  .regex(/^\d{4}\/\d{4}$/u)
  .refine((year) => Number(year.slice(5)) === Number(year.slice(0, 4)) + 1, {
    message: "A school year spans two consecutive years",
  });

export const albumInputSchema = z.strictObject({
  schoolYear: schoolYearSchema,
  slug: slugSchema,
  title: line(200),
  description: z.string().trim().max(2000),
});

export const albumPublicationSchema = z.strictObject({
  action: z.enum(["publish", "unpublish"]),
});

export const panelAlbumSchema = albumInputSchema.extend({
  id: z.uuid(),
  publishedAt: z.string().nullable(),
  photoCount: z.int().min(0),
  updatedAt: z.string().min(1),
});

export const panelAlbumListQuerySchema = z.strictObject({
  schoolYear: schoolYearSchema.optional(),
});

export const panelAlbumListSchema = z.strictObject({
  items: z.array(panelAlbumSchema).max(MAX_LISTED_ALBUMS),
});

export const photoVariantSchema = z.enum(["s", "l"]);

export function photoKey(sha256: string, variant: z.infer<typeof photoVariantSchema>): string {
  return `g/${sha256}-${variant}.webp`;
}

export const photoFieldsSchema = z.strictObject({
  alt: line(300),
  consent: z.literal("true"),
});

export const photoAltSchema = z.strictObject({ alt: line(300) });

export const panelPhotoSchema = z.strictObject({
  id: z.uuid(),
  albumId: z.uuid(),
  position: z.int().min(0),
  width: z.int().min(1).max(LARGE_LONG_EDGE),
  height: z.int().min(1).max(LARGE_LONG_EDGE),
  alt: line(300),
  sha256: sha256Schema,
  consentBy: z.string().min(1),
  consentAt: z.string().min(1),
  createdAt: z.string().min(1),
});

export const panelAlbumViewSchema = z.strictObject({
  item: panelAlbumSchema,
  photos: z.array(panelPhotoSchema).max(MAX_ALBUM_PHOTOS),
});

export const panelPhotoUploadSchema = z.strictObject({
  item: panelPhotoSchema,
  duplicate: z.boolean(),
});

export type AlbumInput = z.infer<typeof albumInputSchema>;
export type PanelAlbum = z.infer<typeof panelAlbumSchema>;
export type PanelPhoto = z.infer<typeof panelPhotoSchema>;
