import {
  panelAlbumSchema,
  panelPhotoSchema,
  type PanelAlbum,
  type PanelPhoto,
} from "@zsm3/contracts/gallery";
import { z } from "zod";

export const albumRowSchema = z.object({
  id: z.string(),
  school_year: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  published_at: z.string().nullable(),
  updated_at: z.string(),
  photo_count: z.number(),
});

export const photoRowSchema = z.object({
  id: z.string(),
  album_id: z.string(),
  position: z.number(),
  width: z.number(),
  height: z.number(),
  alt: z.string(),
  sha256: z.string(),
  consent_by: z.string(),
  consent_at: z.string(),
  created_at: z.string(),
});

export const knownRowSchema = photoRowSchema.extend({ live: z.number() });

export const albumIdRowSchema = z.object({ id: z.string() });

export function albumFromRow(row: z.infer<typeof albumRowSchema>): PanelAlbum {
  return panelAlbumSchema.parse({
    id: row.id,
    schoolYear: row.school_year,
    slug: row.slug,
    title: row.title,
    description: row.description,
    publishedAt: row.published_at,
    photoCount: row.photo_count,
    updatedAt: row.updated_at,
  });
}

export function photoFromRow(row: z.infer<typeof photoRowSchema>): PanelPhoto {
  return panelPhotoSchema.parse({
    id: row.id,
    albumId: row.album_id,
    position: row.position,
    width: row.width,
    height: row.height,
    alt: row.alt,
    sha256: row.sha256,
    consentBy: row.consent_by,
    consentAt: row.consent_at,
    createdAt: row.created_at,
  });
}
