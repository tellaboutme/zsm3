import { sweepShortLinkFilesSafely } from "./short-link-files.ts";
import type { MediaBucket } from "../app-env.ts";
import type { Store } from "../storage/database.ts";
import {
  RATE_LIMIT_PRUNE_BATCH,
  RATE_LIMIT_RETENTION_MS,
  rateLimitsRepo,
} from "../storage/rate-limits-repo.ts";
import { LAPSED_PRUNE_BATCH, shortLinksRepo } from "../storage/short-links-repo.ts";

const DAY_MS = 86_400_000;

export const LAPSED_RETENTION_MS = 30 * DAY_MS;

export async function runHousekeeping(store: Store, bucket: MediaBucket, now: Date): Promise<void> {
  await rateLimitsRepo(store).prune(
    new Date(now.getTime() - RATE_LIMIT_RETENTION_MS).toISOString(),
    RATE_LIMIT_PRUNE_BATCH,
  );
  await shortLinksRepo(store).pruneLapsed(
    new Date(now.getTime() - LAPSED_RETENTION_MS).toISOString(),
    LAPSED_PRUNE_BATCH,
  );
  await sweepShortLinkFilesSafely(store, bucket, now);
}
