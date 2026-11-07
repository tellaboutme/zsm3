import { MAX_ALBUM_PHOTOS, MAX_LISTED_ALBUMS } from "@zsm3/contracts/gallery";
import {
  MAX_LISTED_YEARS,
  type PublicAlbum,
  type PublicAlbumView,
  type PublicYear,
} from "@zsm3/contracts/gallery-public";
import { z } from "zod";

import { allRows, firstRow, type Store } from "./database.ts";

const PUBLIC_ALBUM = "a.published_at IS NOT NULL AND a.deleted_at IS NULL";

const ALBUM_COLUMNS = `SELECT a.id, a.school_year, a.slug, a.title, a.description, c.sha256,
  (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id AND p.deleted_at IS NULL) AS photo_count
  FROM albums a JOIN photos c ON c.id = (SELECT f.id FROM photos f
    WHERE f.album_id = a.id AND f.deleted_at IS NULL ORDER BY f.position, f.id LIMIT 1)`;

const SELECT_YEARS = `SELECT a.school_year, COUNT(*) AS album_count FROM albums a
  WHERE ${PUBLIC_ALBUM} GROUP BY a.school_year ORDER BY a.school_year DESC LIMIT ?`;

const SELECT_YEAR_ALBUMS = `${ALBUM_COLUMNS} WHERE ${PUBLIC_ALBUM} AND a.school_year = ?1
  ORDER BY a.published_at DESC, a.id DESC LIMIT ?2`;

const SELECT_ALBUM_BY_ID = `${ALBUM_COLUMNS} WHERE ${PUBLIC_ALBUM} AND a.id = ?`;

const SELECT_ALBUM_BY_SLUG = `${ALBUM_COLUMNS} WHERE ${PUBLIC_ALBUM}
  AND a.school_year = ? AND a.slug = ?`;

const SELECT_PHOTOS = `SELECT id, width, height, alt, sha256 FROM photos
  WHERE album_id = ? AND deleted_at IS NULL ORDER BY position, id LIMIT ?`;

const SELECT_PUBLIC_PHOTO = `SELECT p.id FROM photos p JOIN albums a ON a.id = p.album_id
  WHERE p.sha256 = ? AND p.deleted_at IS NULL AND ${PUBLIC_ALBUM}`;

const yearRowSchema = z.object({ school_year: z.string(), album_count: z.number() });

const albumRowSchema = z.object({
  id: z.string(),
  school_year: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  sha256: z.string(),
  photo_count: z.number(),
});

const photoRowSchema = z.object({
  id: z.string(),
  width: z.number(),
  height: z.number(),
  alt: z.string(),
  sha256: z.string(),
});

const idRowSchema = z.object({ id: z.string() });

function albumFromRow(row: z.infer<typeof albumRowSchema>): PublicAlbum {
  return {
    id: row.id,
    schoolYear: row.school_year,
    slug: row.slug,
    title: row.title,
    description: row.description,
    photoCount: row.photo_count,
    coverSha256: row.sha256,
  };
}

export interface GalleryPublicRepo {
  years(): Promise<readonly PublicYear[]>;
  albums(schoolYear: string): Promise<readonly PublicAlbum[]>;
  albumById(id: string): Promise<PublicAlbumView | undefined>;
  albumBySlug(schoolYear: string, slug: string): Promise<PublicAlbumView | undefined>;
  isPublicPhoto(sha256: string): Promise<boolean>;
}

export function galleryPublicRepo({ db }: Store): GalleryPublicRepo {
  const view = async (
    row: z.infer<typeof albumRowSchema> | undefined,
  ): Promise<PublicAlbumView | undefined> => {
    if (row === undefined) {
      return undefined;
    }
    const query = db.prepare(SELECT_PHOTOS).bind(row.id, MAX_ALBUM_PHOTOS);
    return { item: albumFromRow(row), photos: [...(await allRows(query, photoRowSchema))] };
  };
  return {
    years: async () => {
      const rows = await allRows(db.prepare(SELECT_YEARS).bind(MAX_LISTED_YEARS), yearRowSchema);
      return rows.map((row) => ({ schoolYear: row.school_year, albumCount: row.album_count }));
    },
    albums: async (schoolYear) => {
      const query = db.prepare(SELECT_YEAR_ALBUMS).bind(schoolYear, MAX_LISTED_ALBUMS);
      return (await allRows(query, albumRowSchema)).map((row) => albumFromRow(row));
    },
    albumById: async (id) =>
      view(await firstRow(db.prepare(SELECT_ALBUM_BY_ID).bind(id), albumRowSchema)),
    albumBySlug: async (schoolYear, slug) =>
      view(await firstRow(db.prepare(SELECT_ALBUM_BY_SLUG).bind(schoolYear, slug), albumRowSchema)),
    isPublicPhoto: async (sha256) =>
      (await firstRow(db.prepare(SELECT_PUBLIC_PHOTO).bind(sha256), idRowSchema)) !== undefined,
  };
}
