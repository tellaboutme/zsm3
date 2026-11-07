import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { photoKey } from "@zsm3/contracts/gallery";

import type { SqlDatabase } from "../src/storage/database.ts";

interface GalleryBucket {
  put(key: string, value: Uint8Array): Promise<unknown>;
}

interface SeedAlbum {
  readonly id: string;
  readonly schoolYear: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly published: boolean;
  readonly photos: readonly number[];
}

const AUTHOR = "seed@zsm3.test";
const SEEDED_AT = "2026-10-01T08:00:00.000Z";
const LARGE_LONG = 1200;
const LARGE_SHORT = 800;
const PORTRAIT_PHOTO = 5;

const ALBUMS: readonly SeedAlbum[] = [
  {
    id: "01890a5d-ac96-7abc-8def-000000000001",
    schoolYear: "2025/2026",
    slug: "przykladowy-album",
    title: "Przykładowy album",
    description: "Syntetyczne grafiki do lokalnych testów galerii.",
    published: true,
    photos: [1, 2, 3, 4, 5],
  },
  {
    id: "01890a5d-ac96-7abc-8def-000000000003",
    schoolYear: "2025/2026",
    slug: "szkic-albumu",
    title: "Szkic albumu",
    description: "Album nieopublikowany.",
    published: false,
    photos: [6],
  },
];

const INSERT_ALBUM = `INSERT OR IGNORE INTO albums
  (id, school_year, slug, title, description, created_by, created_at, updated_at)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)`;

const PUBLISH_ALBUM = "UPDATE albums SET published_at = ?1 WHERE id = ?2";

const INSERT_PHOTO = `INSERT OR IGNORE INTO photos (id, album_id, position, width, height, alt,
    sha256, consent_by, consent_at, created_by, created_at)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?8, ?9)`;

async function seedFile(photo: number, variant: "s" | "l"): Promise<Uint8Array> {
  return readFile(new URL(`gallery/synthetic-${String(photo)}-${variant}.webp`, import.meta.url));
}

async function seedPhoto(
  db: SqlDatabase,
  media: GalleryBucket,
  album: SeedAlbum,
  photo: number,
): Promise<void> {
  const large = await seedFile(photo, "l");
  const sha256 = createHash("sha256").update(large).digest("hex");
  await media.put(photoKey(sha256, "l"), large);
  await media.put(photoKey(sha256, "s"), await seedFile(photo, "s"));
  const portrait = photo === PORTRAIT_PHOTO;
  await db
    .prepare(INSERT_PHOTO)
    .bind(
      `01890a5d-ac96-7abc-8def-1000000000${String(photo).padStart(2, "0")}`,
      album.id,
      photo,
      portrait ? LARGE_SHORT : LARGE_LONG,
      portrait ? LARGE_LONG : LARGE_SHORT,
      `Syntetyczna grafika numer ${String(photo)}: koła i pasy w kolorach szkoły.`,
      sha256,
      AUTHOR,
      SEEDED_AT,
    )
    .run();
}

export async function seedGallery(db: SqlDatabase, media: GalleryBucket): Promise<void> {
  for (const album of ALBUMS) {
    await db
      .prepare(INSERT_ALBUM)
      .bind(
        album.id,
        album.schoolYear,
        album.slug,
        album.title,
        album.description,
        AUTHOR,
        SEEDED_AT,
      )
      .run();
    for (const photo of album.photos) {
      await seedPhoto(db, media, album, photo);
    }
    if (album.published) {
      await db.prepare(PUBLISH_ALBUM).bind(SEEDED_AT, album.id).run();
    }
  }
}
