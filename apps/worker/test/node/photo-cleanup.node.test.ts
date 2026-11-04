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
  ABANDONED_UPLOAD_MS,
  PHOTO_CLEANUP_BATCH,
  runPhotoCleanup,
} from "../../src/jobs/photo-cleanup.ts";
import { UPLOAD_LEASE_MS } from "../../src/storage/photo-uploads-repo.ts";

const AFTER_GRACE = new Date(START.getTime() + ABANDONED_UPLOAD_MS + 1);
const JUST_IN_GRACE = new Date(START.getTime() + ABANDONED_UPLOAD_MS);

let fixture: CleanupFixture;

beforeEach(() => {
  fixture = cleanupFixture();
});

describe("abandoned uploads", () => {
  it("removes both variants and the journal row after the grace period", async ({ expect }) => {
    await fixture.uploads.begin(HASH);
    const bucket = fakeBucket([HASH, OTHER_HASH]);
    expect(await runPhotoCleanup(bucket, fixture.store, AFTER_GRACE)).toBe(1);
    expect([...bucket.keys].toSorted()).toEqual([
      photoKey(OTHER_HASH, "l"),
      photoKey(OTHER_HASH, "s"),
    ]);
    expect(fixture.journal()).toEqual({ total: 0 });
  });

  it("leaves an upload alone until the grace period has passed", async ({ expect }) => {
    await fixture.uploads.begin(HASH);
    const bucket = fakeBucket([HASH]);
    expect(await runPhotoCleanup(bucket, fixture.store, JUST_IN_GRACE)).toBe(0);
    expect(bucket.keys.size).toBe(2);
    expect(fixture.journal()).toEqual({ total: 1 });
  });

  it("removes a bounded batch per run and finishes on the next one", async ({ expect }) => {
    const hashes = [...Array(PHOTO_CLEANUP_BATCH + 1).keys()].map((index) =>
      index.toString(16).padStart(64, "0"),
    );
    for (const hash of hashes) {
      await fixture.uploads.begin(hash);
    }
    const bucket = fakeBucket(hashes);
    expect(await runPhotoCleanup(bucket, fixture.store, AFTER_GRACE)).toBe(PHOTO_CLEANUP_BATCH);
    expect(await runPhotoCleanup(bucket, fixture.store, AFTER_GRACE)).toBe(1);
    expect(bucket.keys.size).toBe(0);
  });

  it("keeps the claim and retries when R2 refuses the delete", async ({ expect }) => {
    await fixture.uploads.begin(HASH);
    const bucket = fakeBucket([HASH]);
    bucket.failNext();
    await expect(runPhotoCleanup(bucket, fixture.store, AFTER_GRACE)).rejects.toThrow(
      "R2 unavailable",
    );
    expect(fixture.journal()).toEqual({ total: 1 });
    expect(await runPhotoCleanup(bucket, fixture.store, AFTER_GRACE)).toBe(1);
    expect(bucket.keys.size).toBe(0);
  });
});

describe("files another record uses", () => {
  it.for([
    ["live", null],
    ["soft-deleted", "2026-11-03T07:00:00Z"],
  ] as const)("never deletes the files of a %s photo", async ([, deletedAt], { expect }) => {
    await fixture.uploads.begin(HASH);
    fixture.savePhoto(HASH, deletedAt);
    const bucket = fakeBucket([HASH]);
    expect(await runPhotoCleanup(bucket, fixture.store, AFTER_GRACE)).toBe(0);
    expect(bucket.keys.size).toBe(2);
    expect(fixture.journal()).toEqual({ total: 0 });
  });

  it("keeps the journal row of a saved photo until the grace period ends", async ({ expect }) => {
    await fixture.uploads.begin(HASH);
    fixture.savePhoto(HASH, null);
    await runPhotoCleanup(fakeBucket([HASH]), fixture.store, JUST_IN_GRACE);
    expect(fixture.journal()).toEqual({ total: 1 });
  });
});

describe("a new upload of the same photo", () => {
  it("is refused while another upload holds the lease", async ({ expect }) => {
    expect(await fixture.uploads.begin(HASH)).toBe(true);
    fixture.setClock(new Date(START.getTime() + UPLOAD_LEASE_MS));
    expect(await fixture.uploads.begin(HASH)).toBe(false);
  });

  it("takes over an expired lease and restarts the grace period", async ({ expect }) => {
    await fixture.uploads.begin(HASH);
    fixture.setClock(new Date(START.getTime() + UPLOAD_LEASE_MS + 1));
    expect(await fixture.uploads.begin(HASH)).toBe(true);
    const bucket = fakeBucket([HASH]);
    expect(await runPhotoCleanup(bucket, fixture.store, AFTER_GRACE)).toBe(0);
    expect(bucket.keys.size).toBe(2);
  });

  it("is refused while cleanup holds the claim, and allowed once it is done", async ({
    expect,
  }) => {
    await fixture.uploads.begin(HASH);
    const bucket = fakeBucket([HASH]);
    bucket.failNext();
    await expect(runPhotoCleanup(bucket, fixture.store, AFTER_GRACE)).rejects.toThrow();
    expect(await fixture.uploads.begin(HASH)).toBe(false);
    await runPhotoCleanup(bucket, fixture.store, AFTER_GRACE);
    expect(await fixture.uploads.begin(HASH)).toBe(true);
  });

  it("does not forget a journal row nobody claimed", async ({ expect }) => {
    await fixture.uploads.begin(HASH);
    await fixture.uploads.forgetClaimed(HASH);
    expect(fixture.journal()).toEqual({ total: 1 });
  });
});
