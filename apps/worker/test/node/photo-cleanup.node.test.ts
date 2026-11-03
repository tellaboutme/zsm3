import { photoKey } from "@zsm3/contracts/gallery";
import { beforeEach, describe, it } from "vitest";

import { memoryDatabase, counterRandom, type MemoryDatabase } from "./memory-database.ts";
import {
  ABANDONED_UPLOAD_MS,
  PHOTO_CLEANUP_BATCH,
  runPhotoCleanup,
  type PhotoCleanupBucket,
} from "../../src/jobs/photo-cleanup.ts";
import type { Store } from "../../src/storage/database.ts";
import { photoUploadsRepo, type PhotoUploadsRepo } from "../../src/storage/photo-uploads-repo.ts";

const START = new Date("2026-11-03T08:00:00Z");
const AFTER_GRACE = new Date(START.getTime() + ABANDONED_UPLOAD_MS + 1);
const JUST_IN_GRACE = new Date(START.getTime() + ABANDONED_UPLOAD_MS);
const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);

interface FakeBucket extends PhotoCleanupBucket {
  readonly keys: Set<string>;
  failNext(): void;
}

function fakeBucket(hashes: readonly string[]): FakeBucket {
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

let db: MemoryDatabase;
let clockNow: Date;
let store: Store;
let uploads: PhotoUploadsRepo;

function journal(): unknown {
  return db.sqlite.prepare("SELECT COUNT(*) AS total FROM photo_uploads").get();
}

function savePhoto(sha256: string, deletedAt: string | null): void {
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
}

beforeEach(() => {
  db = memoryDatabase();
  clockNow = START;
  store = { db, clock: () => clockNow, random: counterRandom() };
  uploads = photoUploadsRepo(store);
});

describe("abandoned uploads", () => {
  it("removes both variants and the journal row after the grace period", async ({ expect }) => {
    await uploads.begin(HASH);
    const bucket = fakeBucket([HASH, OTHER_HASH]);
    expect(await runPhotoCleanup(bucket, store, AFTER_GRACE)).toBe(1);
    expect([...bucket.keys].toSorted()).toEqual([
      photoKey(OTHER_HASH, "l"),
      photoKey(OTHER_HASH, "s"),
    ]);
    expect(journal()).toEqual({ total: 0 });
  });

  it("leaves an upload alone until the grace period has passed", async ({ expect }) => {
    await uploads.begin(HASH);
    const bucket = fakeBucket([HASH]);
    expect(await runPhotoCleanup(bucket, store, JUST_IN_GRACE)).toBe(0);
    expect(bucket.keys.size).toBe(2);
    expect(journal()).toEqual({ total: 1 });
  });

  it("removes a bounded batch per run and finishes on the next one", async ({ expect }) => {
    const hashes = [...Array(PHOTO_CLEANUP_BATCH + 1).keys()].map((index) =>
      index.toString(16).padStart(64, "0"),
    );
    for (const hash of hashes) {
      await uploads.begin(hash);
    }
    const bucket = fakeBucket(hashes);
    expect(await runPhotoCleanup(bucket, store, AFTER_GRACE)).toBe(PHOTO_CLEANUP_BATCH);
    expect(await runPhotoCleanup(bucket, store, AFTER_GRACE)).toBe(1);
    expect(bucket.keys.size).toBe(0);
  });

  it("keeps the claim and retries when R2 refuses the delete", async ({ expect }) => {
    await uploads.begin(HASH);
    const bucket = fakeBucket([HASH]);
    bucket.failNext();
    await expect(runPhotoCleanup(bucket, store, AFTER_GRACE)).rejects.toThrow("R2 unavailable");
    expect(journal()).toEqual({ total: 1 });
    expect(await runPhotoCleanup(bucket, store, AFTER_GRACE)).toBe(1);
    expect(bucket.keys.size).toBe(0);
  });
});

describe("files another record uses", () => {
  it.for([
    ["live", null],
    ["soft-deleted", "2026-11-03T07:00:00Z"],
  ] as const)("never deletes the files of a %s photo", async ([, deletedAt], { expect }) => {
    await uploads.begin(HASH);
    savePhoto(HASH, deletedAt);
    const bucket = fakeBucket([HASH]);
    expect(await runPhotoCleanup(bucket, store, AFTER_GRACE)).toBe(0);
    expect(bucket.keys.size).toBe(2);
    expect(journal()).toEqual({ total: 0 });
  });

  it("keeps the journal row of a saved photo until the grace period ends", async ({ expect }) => {
    await uploads.begin(HASH);
    savePhoto(HASH, null);
    await runPhotoCleanup(fakeBucket([HASH]), store, JUST_IN_GRACE);
    expect(journal()).toEqual({ total: 1 });
  });
});

describe("a new upload of the same photo", () => {
  it("restarts the grace period, so running uploads are not claimed", async ({ expect }) => {
    await uploads.begin(HASH);
    clockNow = JUST_IN_GRACE;
    expect(await uploads.begin(HASH)).toBe(true);
    const bucket = fakeBucket([HASH]);
    expect(await runPhotoCleanup(bucket, store, AFTER_GRACE)).toBe(0);
    expect(bucket.keys.size).toBe(2);
  });

  it("is refused while cleanup holds the claim, and allowed once it is done", async ({
    expect,
  }) => {
    await uploads.begin(HASH);
    const bucket = fakeBucket([HASH]);
    bucket.failNext();
    await expect(runPhotoCleanup(bucket, store, AFTER_GRACE)).rejects.toThrow();
    expect(await uploads.begin(HASH)).toBe(false);
    await runPhotoCleanup(bucket, store, AFTER_GRACE);
    expect(await uploads.begin(HASH)).toBe(true);
  });

  it("does not forget a journal row nobody claimed", async ({ expect }) => {
    await uploads.begin(HASH);
    await uploads.forgetClaimed(HASH);
    expect(journal()).toEqual({ total: 1 });
  });
});
