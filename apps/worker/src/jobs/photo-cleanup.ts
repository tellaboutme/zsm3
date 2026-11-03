import { photoKey } from "@zsm3/contracts/gallery";

import type { Store } from "../storage/database.ts";
import { photoUploadsRepo } from "../storage/photo-uploads-repo.ts";

export const ABANDONED_UPLOAD_MS = 86_400_000;
export const PHOTO_CLEANUP_BATCH = 50;

export interface PhotoCleanupBucket {
  delete(keys: string[]): Promise<void>;
}

export async function runPhotoCleanup(
  bucket: PhotoCleanupBucket,
  store: Store,
  now: Date,
): Promise<number> {
  const uploads = photoUploadsRepo(store);
  const cutoff = new Date(now.getTime() - ABANDONED_UPLOAD_MS).toISOString();
  await uploads.releaseSaved(cutoff);
  await uploads.claimAbandoned(cutoff);
  const claimed = await uploads.claimed(PHOTO_CLEANUP_BATCH);
  for (const sha256 of claimed) {
    await bucket.delete([photoKey(sha256, "l"), photoKey(sha256, "s")]);
    await uploads.forgetClaimed(sha256);
  }
  return claimed.length;
}
