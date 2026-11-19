import {
  FEATURED_SLOTS,
  featuredSlotSchema,
  type FeaturedSlot,
  type PanelFeaturedPhoto,
  type PublicFeaturedPhoto,
} from "@zsm3/contracts/featured";
import { z } from "zod";

import { allRows, firstRow, timestamp, type SqlStatement, type Store } from "./database.ts";

export interface FeaturedRepo {
  list(): Promise<readonly PanelFeaturedPhoto[]>;
  published(): Promise<readonly PublicFeaturedPhoto[]>;
  slot(slot: FeaturedSlot): Promise<PanelFeaturedPhoto | undefined>;
  livePhoto(photoId: string): Promise<boolean>;
  setStatement(slot: FeaturedSlot, photoId: string, staffEmail: string): SqlStatement;
  clearStatement(slot: FeaturedSlot): SqlStatement;
}

const LIVE_PHOTO = "p.deleted_at IS NULL AND a.deleted_at IS NULL";

const PUBLISHED = `${LIVE_PHOTO} AND a.published_at IS NOT NULL`;

const COLUMNS = `SELECT f.slot, f.photo_id, f.updated_at, p.album_id, p.width, p.height,
  p.alt, p.sha256, a.title AS album_title, a.published_at
  FROM featured_photos f JOIN photos p ON p.id = f.photo_id JOIN albums a ON a.id = p.album_id`;

const SELECT_ALL = `${COLUMNS} WHERE ${LIVE_PHOTO} ORDER BY f.slot LIMIT ?`;

const SELECT_PUBLISHED = `${COLUMNS} WHERE ${PUBLISHED} ORDER BY f.slot LIMIT ?`;

const SELECT_SLOT = `${COLUMNS} WHERE ${LIVE_PHOTO} AND f.slot = ?`;

const SELECT_LIVE_PHOTO = `SELECT p.id FROM photos p JOIN albums a ON a.id = p.album_id
  WHERE p.id = ? AND ${LIVE_PHOTO}`;

const UPSERT = `INSERT INTO featured_photos (slot, photo_id, updated_by, updated_at)
  VALUES (?1, ?2, ?3, ?4) ON CONFLICT (slot) DO UPDATE SET photo_id = excluded.photo_id,
  updated_by = excluded.updated_by, updated_at = excluded.updated_at`;

const DELETE_SLOT = "DELETE FROM featured_photos WHERE slot = ?";

const rowSchema = z.object({
  slot: featuredSlotSchema,
  photo_id: z.string(),
  updated_at: z.string(),
  album_id: z.string(),
  width: z.number(),
  height: z.number(),
  alt: z.string(),
  sha256: z.string(),
  album_title: z.string(),
  published_at: z.string().nullable(),
});

type Row = z.infer<typeof rowSchema>;

function publicFromRow(row: Row): PublicFeaturedPhoto {
  return {
    slot: row.slot,
    width: row.width,
    height: row.height,
    alt: row.alt,
    sha256: row.sha256,
  };
}

function panelFromRow(row: Row): PanelFeaturedPhoto {
  return {
    ...publicFromRow(row),
    photoId: row.photo_id,
    albumId: row.album_id,
    albumTitle: row.album_title,
    published: row.published_at !== null,
    updatedAt: row.updated_at,
  };
}

export function featuredRepo({ db, clock }: Store): FeaturedRepo {
  return {
    list: async () =>
      (await allRows(db.prepare(SELECT_ALL).bind(FEATURED_SLOTS.length), rowSchema)).map(
        panelFromRow,
      ),
    published: async () =>
      (await allRows(db.prepare(SELECT_PUBLISHED).bind(FEATURED_SLOTS.length), rowSchema)).map(
        publicFromRow,
      ),
    slot: async (slot) => {
      const row = await firstRow(db.prepare(SELECT_SLOT).bind(slot), rowSchema);
      return row === undefined ? undefined : panelFromRow(row);
    },
    livePhoto: async (photoId) =>
      (await firstRow(
        db.prepare(SELECT_LIVE_PHOTO).bind(photoId),
        z.object({ id: z.string() }),
      )) !== undefined,
    setStatement: (slot, photoId, staffEmail) =>
      db.prepare(UPSERT).bind(slot, photoId, staffEmail, timestamp(clock)),
    clearStatement: (slot) => db.prepare(DELETE_SLOT).bind(slot),
  };
}
