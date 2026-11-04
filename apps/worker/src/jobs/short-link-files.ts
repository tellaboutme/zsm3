import type { MediaBucket } from "../app-env.ts";
import { STALE_FILE_BATCH, type ShortLinkFilesRepo } from "../storage/short-link-files-repo.ts";

export const PENDING_UPLOAD_GRACE_MS = 60 * 60 * 1000;

export async function sweepShortLinkFiles(
  files: ShortLinkFilesRepo,
  bucket: MediaBucket,
  now: Date,
): Promise<number> {
  const at = now.toISOString();
  const keys = await files.stale({
    pendingBefore: new Date(now.getTime() - PENDING_UPLOAD_GRACE_MS).toISOString(),
    now: at,
    limit: STALE_FILE_BATCH,
  });
  for (const key of keys) {
    await bucket.delete(key);
    await files.markRemoved(key, at);
  }
  await files.forgetDetached();
  return keys.length;
}
