import { photoKey } from "@zsm3/contracts/gallery";

import { memoryDatabase } from "./memory-database.ts";
import { createApp } from "../../src/app.ts";

export const ORIGIN = "https://zsm3.test";
export const NOW = "2026-10-22T08:00:00.000Z";
export const LIVE = "01890a5d-ac96-7abc-8def-000000000001";
export const DRAFT = "01890a5d-ac96-7abc-8def-000000000003";
export const HASH = "a1".repeat(32);
export const SECOND = "a2".repeat(32);
export const GONE = "a3".repeat(32);
export const OLD_HASH = "a4".repeat(32);
export const DRAFT_HASH = "a5".repeat(32);
const OLDER = "01890a5d-ac96-7abc-8def-000000000002";

const INSERT_ALBUM = `INSERT INTO albums
  (id, school_year, slug, title, description, created_by, created_at, updated_at)
  VALUES (?1, ?2, ?3, ?4, ?5, 'a@zsm3.test', ?6, ?6)`;
const INSERT_PHOTO = `INSERT INTO photos (id, album_id, position, width, height, alt, sha256,
  consent_by, consent_at, deleted_at, created_by, created_at)
  VALUES (?1, ?2, ?3, 1600, 900, ?4, ?5, 'staff@zsm3.test', ?6, ?7, 'staff@zsm3.test', ?6)`;

export interface GalleryFixture {
  readonly DB: ReturnType<typeof memoryDatabase>;
  readonly files: Map<string, string>;
  get(path: string): Promise<Response>;
  setPublished(id: string, publishedAt: string | null): Promise<void>;
}

function mediaBucket(files: Map<string, string>): object {
  return {
    get: async (key: string) => {
      const text = files.get(key);
      return await Promise.resolve(
        text === undefined
          ? null
          : { body: new Response(text).body, size: text.length, httpEtag: '"r2"' },
      );
    },
  };
}

export async function galleryFixture(): Promise<GalleryFixture> {
  const DB = memoryDatabase();
  const files = new Map<string, string>();
  const insertPhoto = async (
    serial: string,
    album: string,
    sha256: string,
    deletedAt: string | null = null,
  ): Promise<void> => {
    const id = `01890a5d-ac96-7abc-8def-1000000000${serial}`;
    await DB.prepare(INSERT_PHOTO)
      .bind(id, album, Number(serial), `Zdjęcie ${serial}`, sha256, NOW, deletedAt)
      .run();
    files.set(photoKey(sha256, "s"), `small ${serial}`);
    files.set(photoKey(sha256, "l"), `large ${serial}`);
  };
  const setPublished = async (id: string, publishedAt: string | null): Promise<void> => {
    await DB.prepare("UPDATE albums SET published_at = ? WHERE id = ?").bind(publishedAt, id).run();
  };
  for (const [id, year, slug] of [
    [LIVE, "2025/2026", "apel"],
    [OLDER, "2024/2025", "dawny"],
    [DRAFT, "2025/2026", "szkic"],
  ] as const) {
    await DB.prepare(INSERT_ALBUM).bind(id, year, slug, slug, "", NOW).run();
  }
  await insertPhoto("01", LIVE, HASH);
  await insertPhoto("02", LIVE, SECOND);
  await insertPhoto("03", LIVE, GONE, NOW);
  await insertPhoto("04", OLDER, OLD_HASH);
  await insertPhoto("05", DRAFT, DRAFT_HASH);
  await setPublished(LIVE, NOW);
  await setPublished(OLDER, NOW);
  const get = async (path: string): Promise<Response> =>
    await createApp().request(`${ORIGIN}${path}`, {}, { DB, MEDIA: mediaBucket(files) });
  return { DB, files, get, setPublished };
}
