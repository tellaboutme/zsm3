import { photoKey } from "@zsm3/contracts/gallery";

import { auditRepo } from "../storage/audit-repo.ts";
import type { Store } from "../storage/database.ts";
import { photoUploadsRepo, type PhotoUploadsRepo } from "../storage/photo-uploads-repo.ts";

export const ABANDONED_UPLOAD_MS = 86_400_000;
export const DELETED_PHOTO_MS = 30 * ABANDONED_UPLOAD_MS;
export const PHOTO_CLEANUP_BATCH = 50;

export interface PhotoCleanupBucket {
  delete(keys: string[]): Promise<void>;
}

function msAgo(now: Date, ms: number): string {
  return new Date(now.getTime() - ms).toISOString();
}

async function retireExpiredPhotos(
  uploads: PhotoUploadsRepo,
  store: Store,
  cutoff: string,
): Promise<void> {
  const audit = auditRepo(store);
  for (const photo of await uploads.expired(cutoff, PHOTO_CLEANUP_BATCH)) {
    if (await uploads.retireExpired(photo.sha256, cutoff)) {
      await audit.append({
        actorEmail: null,
        action: "photos.purge",
        entity: "photos",
        entityId: photo.id,
        details: JSON.stringify({ fields: ["files"] }),
      });
    }
  }
}

export async function runPhotoCleanup(
  bucket: PhotoCleanupBucket,
  store: Store,
  now: Date,
): Promise<number> {
  const uploads = photoUploadsRepo(store);
  const abandoned = msAgo(now, ABANDONED_UPLOAD_MS);
  const deleted = msAgo(now, DELETED_PHOTO_MS);
  await uploads.releaseSaved(abandoned);
  await uploads.claimAbandoned(abandoned);
  await retireExpiredPhotos(uploads, store, deleted);
  const claimed = await uploads.claimed(PHOTO_CLEANUP_BATCH);
  for (const sha256 of claimed) {
    await bucket.delete([photoKey(sha256, "l"), photoKey(sha256, "s")]);
    await uploads.forgetClaimed(sha256);
  }
  await uploads.removeEmptyAlbums(deleted, PHOTO_CLEANUP_BATCH);
  return claimed.length;
}
