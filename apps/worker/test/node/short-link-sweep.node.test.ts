import { describe, it, vi } from "vitest";

import {
  AUTHOR,
  fileRows,
  fileStore,
  linkCount,
  NOW,
  randomFileStore,
  resolveDeps,
  spyBucket,
  upload,
  uploadDeps,
} from "./short-link-files-support.ts";
import { PDF } from "./zip-fixtures.ts";
import {
  PENDING_UPLOAD_GRACE_MS,
  sweepShortLinkFiles,
  sweepShortLinkFilesSafely,
} from "../../src/jobs/short-link-files.ts";
import { unlockLink } from "../../src/short-links/resolve.ts";
import { createFileLink } from "../../src/short-links/upload.ts";
import type { Store } from "../../src/storage/database.ts";
import { shortLinkFilesRepo, STALE_FILE_BATCH } from "../../src/storage/short-link-files-repo.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

const PENDING_KEY = "s/019a0b6c-1d2e-7f30-8a41-b52c63d74e85";
const DAY_MS = 86_400_000;

async function created(store: Store, bucket: ReturnType<typeof spyBucket>): Promise<string> {
  const outcome = await createFileLink(uploadDeps(store, bucket), upload(PDF));
  if (outcome.kind !== "created") {
    throw new Error("fixture");
  }
  return outcome.code;
}

async function reserve(store: Store): Promise<void> {
  await shortLinkFilesRepo(store).reserve({
    objectKey: PENDING_KEY,
    name: "karta.pdf",
    format: "pdf",
    bytes: 10,
    createdBy: AUTHOR,
  });
}

function later(milliseconds: number): Date {
  return new Date(NOW.getTime() + milliseconds);
}

describe("sweeping private files", () => {
  it("keeps the file of a live link", async ({ expect }) => {
    const store = fileStore();
    const bucket = spyBucket();
    await created(store, bucket);

    await expect(
      sweepShortLinkFiles(shortLinkFilesRepo(store), bucket, later(DAY_MS)),
    ).resolves.toBe(0);
    expect(bucket.keys()).toHaveLength(1);
  });

  it("removes the file once its link is revoked, and keeps the metadata", async ({ expect }) => {
    const store = fileStore();
    const bucket = spyBucket();
    const code = await created(store, bucket);
    const [key] = bucket.keys();
    await shortLinksRepo(store).revoke(code, AUTHOR, NOW.toISOString());

    await expect(sweepShortLinkFiles(shortLinkFilesRepo(store), bucket, later(1))).resolves.toBe(1);
    expect(bucket.keys()).toEqual([]);
    expect(await fileRows(store)).toEqual([
      { object_key: key, code, removed_at: later(1).toISOString() },
    ]);
    await expect(unlockLink(resolveDeps(store), code, undefined, later(2))).resolves.toEqual({
      kind: "gone",
    });
    await expect(sweepShortLinkFiles(shortLinkFilesRepo(store), bucket, later(3))).resolves.toBe(0);
  });

  it("removes the file at the moment its link expires, not before", async ({ expect }) => {
    const store = fileStore();
    const bucket = spyBucket();
    await created(store, bucket);
    const expiry = new Date("2027-08-31T22:00:00.000Z");
    const files = shortLinkFilesRepo(store);

    await expect(sweepShortLinkFiles(files, bucket, new Date(expiry.getTime() - 1))).resolves.toBe(
      0,
    );
    await expect(sweepShortLinkFiles(files, bucket, expiry)).resolves.toBe(1);
    expect(bucket.keys()).toEqual([]);
  });

  it("forgets the file row once the link itself is pruned", async ({ expect }) => {
    const store = fileStore();
    const bucket = spyBucket();
    const code = await created(store, bucket);
    await shortLinksRepo(store).revoke(code, AUTHOR, NOW.toISOString());
    const files = shortLinkFilesRepo(store);
    await sweepShortLinkFiles(files, bucket, later(1));
    await shortLinksRepo(store).pruneLapsed(later(31 * DAY_MS).toISOString(), 10);

    expect(await linkCount(store)).toBe(0);
    await sweepShortLinkFiles(files, bucket, later(31 * DAY_MS));
    expect(await fileRows(store)).toEqual([]);
  });

  it("removes an object whose link was pruned before the sweep reached it", async ({ expect }) => {
    const store = fileStore();
    const bucket = spyBucket();
    const code = await created(store, bucket);
    await shortLinksRepo(store).revoke(code, AUTHOR, NOW.toISOString());
    await shortLinksRepo(store).pruneLapsed(later(31 * DAY_MS).toISOString(), 10);

    await expect(
      sweepShortLinkFiles(shortLinkFilesRepo(store), bucket, later(31 * DAY_MS)),
    ).resolves.toBe(1);
    expect(bucket.keys()).toEqual([]);
    expect(await fileRows(store)).toEqual([]);
  });

  it("waits out the upload grace period before removing an abandoned upload", async ({
    expect,
  }) => {
    const store = fileStore();
    const bucket = spyBucket();
    await reserve(store);
    const files = shortLinkFilesRepo(store);

    expect(PENDING_UPLOAD_GRACE_MS).toBe(3_600_000);
    await expect(sweepShortLinkFiles(files, bucket, later(PENDING_UPLOAD_GRACE_MS))).resolves.toBe(
      0,
    );
    await expect(
      sweepShortLinkFiles(files, bucket, later(PENDING_UPLOAD_GRACE_MS + 1)),
    ).resolves.toBe(1);
    expect(bucket.deleted).toEqual([PENDING_KEY]);
    expect(await fileRows(store)).toEqual([]);
  });

  it("works through a bounded batch per run", async ({ expect }) => {
    const store = randomFileStore();
    const bucket = spyBucket();
    const links = shortLinksRepo(store);
    for (let index = 0; index <= STALE_FILE_BATCH; index += 1) {
      await links.revoke(await created(store, bucket), AUTHOR, NOW.toISOString());
    }
    const files = shortLinkFilesRepo(store);

    expect(STALE_FILE_BATCH).toBe(50);
    await expect(sweepShortLinkFiles(files, bucket, later(1))).resolves.toBe(STALE_FILE_BATCH);
    await expect(sweepShortLinkFiles(files, bucket, later(2))).resolves.toBe(1);
    expect(bucket.keys()).toEqual([]);
  });

  it("keeps the row when R2 fails so the next run tries again", async ({ expect }) => {
    const store = fileStore();
    const bucket = spyBucket();
    const code = await created(store, bucket);
    await shortLinksRepo(store).revoke(code, AUTHOR, NOW.toISOString());
    const broken = { ...bucket, delete: async () => Promise.reject(new TypeError("r2 down")) };
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await sweepShortLinkFilesSafely(store, broken, later(1));
    expect(errors).toHaveBeenCalledWith(
      JSON.stringify({ event: "short_link_file_sweep_failed", errorName: "TypeError" }),
    );
    const strange = vi.fn<(key: string) => Promise<void>>().mockRejectedValue(7);
    await sweepShortLinkFilesSafely(store, { ...bucket, delete: strange }, later(1));
    expect(errors).toHaveBeenLastCalledWith(
      JSON.stringify({ event: "short_link_file_sweep_failed", errorName: "UnknownError" }),
    );
    errors.mockRestore();
    expect(await fileRows(store)).toEqual([expect.objectContaining({ removed_at: null })]);

    await sweepShortLinkFilesSafely(store, bucket, later(2));
    expect(bucket.keys()).toEqual([]);
  });
});
