import { photoKey } from "@zsm3/contracts/gallery";
import { beforeEach, describe, it } from "vitest";

import {
  cleanupFixture,
  fakeBucket,
  HASH,
  OTHER_HASH,
  START,
  type CleanupFixture,
} from "./photo-cleanup-support.ts";
import {
  DELETED_PHOTO_MS,
  PHOTO_CLEANUP_BATCH,
  runPhotoCleanup,
} from "../../src/jobs/photo-cleanup.ts";
import type { Store } from "../../src/storage/database.ts";

let fixture: CleanupFixture;

beforeEach(() => {
  fixture = cleanupFixture();
});

describe("deleted photos", () => {
  const DELETED_AT = START.toISOString();
  const AFTER_RETENTION = new Date(START.getTime() + DELETED_PHOTO_MS + 1);
  const AT_RETENTION = new Date(START.getTime() + DELETED_PHOTO_MS);

  function totals(): unknown {
    return fixture.db.sqlite
      .prepare(
        `SELECT (SELECT COUNT(*) FROM photos) AS photos,
         (SELECT COUNT(*) FROM photo_uploads) AS journal,
         (SELECT COUNT(*) FROM albums) AS albums`,
      )
      .get();
  }

  function purgeAudits(): unknown {
    return fixture.db.sqlite
      .prepare(
        "SELECT actor_email, entity_id, details_json FROM audit_log WHERE action = 'photos.purge'",
      )
      .all();
  }

  it("removes the files and the row once the retention has passed", async ({ expect }) => {
    fixture.savePhoto(HASH, DELETED_AT);
    const bucket = fakeBucket([HASH, OTHER_HASH]);
    expect(await runPhotoCleanup(bucket, fixture.store, AFTER_RETENTION)).toBe(1);
    expect([...bucket.keys].toSorted()).toEqual([
      photoKey(OTHER_HASH, "l"),
      photoKey(OTHER_HASH, "s"),
    ]);
    expect(totals()).toEqual({ photos: 0, journal: 0, albums: 1 });
    expect(purgeAudits()).toEqual([
      { actor_email: null, entity_id: HASH, details_json: '{"fields":["files"]}' },
    ]);
  });

  it("keeps a photo until the retention has passed", async ({ expect }) => {
    fixture.savePhoto(HASH, DELETED_AT);
    const bucket = fakeBucket([HASH]);
    expect(await runPhotoCleanup(bucket, fixture.store, AT_RETENTION)).toBe(0);
    expect(bucket.keys.size).toBe(2);
    expect(totals()).toEqual({ photos: 1, journal: 0, albums: 1 });
  });

  it("never touches a live photo", async ({ expect }) => {
    fixture.savePhoto(HASH, null);
    const bucket = fakeBucket([HASH]);
    expect(await runPhotoCleanup(bucket, fixture.store, AFTER_RETENTION)).toBe(0);
    expect(bucket.keys.size).toBe(2);
  });

  it("retries after a failed R2 delete, with the row already gone", async ({ expect }) => {
    fixture.savePhoto(HASH, DELETED_AT);
    const bucket = fakeBucket([HASH]);
    bucket.failNext();
    await expect(runPhotoCleanup(bucket, fixture.store, AFTER_RETENTION)).rejects.toThrow("R2");
    expect(totals()).toEqual({ photos: 0, journal: 1, albums: 1 });
    expect(await runPhotoCleanup(bucket, fixture.store, AFTER_RETENTION)).toBe(1);
    expect(bucket.keys.size).toBe(0);
    expect(purgeAudits()).toHaveLength(1);
  });

  it("removes photos of a deleted album, then the album", async ({ expect }) => {
    fixture.savePhoto(HASH, null);
    fixture.db.sqlite.prepare("UPDATE albums SET deleted_at = ?").run(DELETED_AT);
    const bucket = fakeBucket([HASH]);
    expect(await runPhotoCleanup(bucket, fixture.store, AT_RETENTION)).toBe(0);
    expect(await runPhotoCleanup(bucket, fixture.store, AFTER_RETENTION)).toBe(1);
    expect(bucket.keys.size).toBe(0);
    expect(totals()).toEqual({ photos: 0, journal: 0, albums: 0 });
  });

  it("keeps a deleted album within the retention", async ({ expect }) => {
    fixture.savePhoto(HASH, DELETED_AT);
    fixture.db.sqlite.prepare("UPDATE albums SET deleted_at = ?").run(DELETED_AT);
    await runPhotoCleanup(fakeBucket([HASH]), fixture.store, AT_RETENTION);
    expect(totals()).toEqual({ photos: 1, journal: 0, albums: 1 });
  });

  it("leaves a photo alone while an upload is restoring it", async ({ expect }) => {
    fixture.savePhoto(HASH, DELETED_AT);
    fixture.setClock(AFTER_RETENTION);
    await fixture.uploads.begin(HASH);
    const bucket = fakeBucket([HASH]);
    expect(await runPhotoCleanup(bucket, fixture.store, AFTER_RETENTION)).toBe(0);
    expect(bucket.keys.size).toBe(2);
    expect(totals()).toEqual({ photos: 1, journal: 1, albums: 1 });
  });

  it("neither audits nor deletes when an upload starts after the listing", async ({ expect }) => {
    fixture.savePhoto(HASH, DELETED_AT);
    fixture.setClock(AFTER_RETENTION);
    let armed = true;
    const racing: Store = {
      ...fixture.store,
      db: {
        prepare: (query) => fixture.db.prepare(query),
        batch: async (statements) => {
          if (armed) {
            armed = false;
            await fixture.uploads.begin(HASH);
          }
          return fixture.db.batch(statements);
        },
      },
    };
    const bucket = fakeBucket([HASH]);
    expect(await runPhotoCleanup(bucket, racing, AFTER_RETENTION)).toBe(0);
    expect(bucket.keys.size).toBe(2);
    expect(purgeAudits()).toEqual([]);
    expect(totals()).toEqual({ photos: 1, journal: 1, albums: 1 });
  });

  it("does not retire a photo restored after it was listed", async ({ expect }) => {
    fixture.savePhoto(HASH, null);
    expect(await fixture.uploads.retireExpired(HASH, AFTER_RETENTION.toISOString())).toBe(false);
    expect(totals()).toEqual({ photos: 1, journal: 0, albums: 1 });
  });

  it("purges a bounded batch per run", async ({ expect }) => {
    const hashes = [...Array(PHOTO_CLEANUP_BATCH + 1).keys()].map((index) =>
      index.toString(16).padStart(64, "0"),
    );
    hashes.forEach((hash) => {
      fixture.savePhoto(hash, DELETED_AT);
    });
    const bucket = fakeBucket(hashes);
    expect(await runPhotoCleanup(bucket, fixture.store, AFTER_RETENTION)).toBe(PHOTO_CLEANUP_BATCH);
    expect(await runPhotoCleanup(bucket, fixture.store, AFTER_RETENTION)).toBe(1);
    expect(bucket.keys.size).toBe(0);
  });
});
