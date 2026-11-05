import { photoKey } from "@zsm3/contracts/gallery";

import { counterRandom, memoryDatabase, type MemoryDatabase } from "./memory-database.ts";
import type { PhotoCleanupBucket } from "../../src/jobs/photo-cleanup.ts";
import type { Store } from "../../src/storage/database.ts";
import { photoUploadsRepo, type PhotoUploadsRepo } from "../../src/storage/photo-uploads-repo.ts";

export const START = new Date("2026-11-03T08:00:00Z");
export const HASH = "a".repeat(64);
export const OTHER_HASH = "b".repeat(64);

export interface FakeBucket extends PhotoCleanupBucket {
  readonly keys: Set<string>;
  failNext(): void;
}

export function fakeBucket(hashes: readonly string[]): FakeBucket {
  const keys = new Set(hashes.flatMap((hash) => [photoKey(hash, "l"), photoKey(hash, "s")]));
  let failing = false;
  return {
    keys,
    failNext: () => {
      failing = true;
    },
    delete: async (names) => {
      if (failing) {
        failing = false;
        throw new Error("R2 unavailable");
      }
      await Promise.resolve();
      names.forEach((name) => keys.delete(name));
    },
  };
}

export interface CleanupFixture {
  readonly db: MemoryDatabase;
  readonly store: Store;
  readonly uploads: PhotoUploadsRepo;
  setClock(now: Date): void;
  savePhoto(sha256: string, deletedAt: string | null): void;
  journal(): unknown;
}

export function cleanupFixture(): CleanupFixture {
  const db = memoryDatabase();
  let now = START;
  const store: Store = { db, clock: () => now, random: counterRandom() };
  return {
    db,
    store,
    uploads: photoUploadsRepo(store),
    setClock: (next) => {
      now = next;
    },
    savePhoto: (sha256, deletedAt) => {
      db.sqlite
        .prepare(
          `INSERT INTO albums (id, school_year, slug, title, description, created_by, created_at, updated_at)
           VALUES ('album', '2026/2027', 'a', 'A', '', 'x', 't', 't') ON CONFLICT DO NOTHING`,
        )
        .run();
      db.sqlite
        .prepare(
          `INSERT INTO photos (id, album_id, position, width, height, alt, sha256, consent_by, consent_at, deleted_at, created_by, created_at)
           VALUES (?, 'album', 0, 1600, 900, 'alt', ?, 'x', 't', ?, 'x', 't')`,
        )
        .run(sha256, sha256, deletedAt);
    },
    journal: () => db.sqlite.prepare("SELECT COUNT(*) AS total FROM photo_uploads").get(),
  };
}
