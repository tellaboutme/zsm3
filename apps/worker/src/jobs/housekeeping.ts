import { sweepShortLinkFiles } from "./short-link-files.ts";
import type { MediaBucket } from "../app-env.ts";
import { retentionCutoffs } from "../domain/question-lifecycle.ts";
import { logEvent } from "../logging/log.ts";
import type { Store } from "../storage/database.ts";
import { questionsRepo } from "../storage/questions-repo.ts";
import {
  RATE_LIMIT_PRUNE_BATCH,
  RATE_LIMIT_RETENTION_MS,
  rateLimitsRepo,
} from "../storage/rate-limits-repo.ts";
import { FAILURE_PRUNE_BATCH, shortLinkFailuresRepo } from "../storage/short-link-failures-repo.ts";
import { shortLinkFilesRepo } from "../storage/short-link-files-repo.ts";
import { LAPSED_PRUNE_BATCH, shortLinksRepo } from "../storage/short-links-repo.ts";

const DAY_MS = 86_400_000;

export const LAPSED_RETENTION_MS = 30 * DAY_MS;
export const QUESTION_PRUNE_BATCH = 100;

export type HousekeepingStep =
  | "rate_limits"
  | "short_link_failures"
  | "lapsed_short_links"
  | "short_link_files"
  | "questions"
  | "photo_cleanup";

export class HousekeepingError extends Error {
  readonly steps: readonly HousekeepingStep[];

  constructor(steps: readonly HousekeepingStep[]) {
    super(`Housekeeping steps failed: ${steps.join(", ")}`);
    this.name = "HousekeepingError";
    this.steps = steps;
  }
}

interface StepContext {
  readonly store: Store;
  readonly bucket: MediaBucket;
  readonly now: Date;
}

type Step = (context: StepContext) => Promise<unknown>;

const STEPS: readonly (readonly [HousekeepingStep, Step])[] = [
  [
    "rate_limits",
    async ({ store, now }) =>
      rateLimitsRepo(store).prune(
        new Date(now.getTime() - RATE_LIMIT_RETENTION_MS).toISOString(),
        RATE_LIMIT_PRUNE_BATCH,
      ),
  ],
  [
    "short_link_failures",
    async ({ store, now }) => shortLinkFailuresRepo(store).prune(now, FAILURE_PRUNE_BATCH),
  ],
  [
    "lapsed_short_links",
    async ({ store, now }) =>
      shortLinksRepo(store).pruneLapsed(
        new Date(now.getTime() - LAPSED_RETENTION_MS).toISOString(),
        LAPSED_PRUNE_BATCH,
      ),
  ],
  [
    "short_link_files",
    async ({ store, bucket, now }) => sweepShortLinkFiles(shortLinkFilesRepo(store), bucket, now),
  ],
  [
    "questions",
    async ({ store, now }) =>
      questionsRepo(store).prune(retentionCutoffs(now), QUESTION_PRUNE_BATCH),
  ],
];

export async function runHousekeeping(
  store: Store,
  bucket: MediaBucket,
  now: Date,
): Promise<readonly HousekeepingStep[]> {
  const failed: HousekeepingStep[] = [];
  for (const [name, step] of STEPS) {
    try {
      await step({ store, bucket, now });
    } catch (error) {
      logEvent({
        event: "housekeeping_step_failed",
        step: name,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      failed.push(name);
    }
  }
  return failed;
}
