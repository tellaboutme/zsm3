import { retentionCutoffs } from "../domain/question-lifecycle.ts";
import { logEvent, type HousekeepingTask } from "../logging/log.ts";
import type { Store } from "../storage/database.ts";
import { questionsRepo } from "../storage/questions-repo.ts";
import {
  RATE_LIMIT_PRUNE_BATCH,
  RATE_LIMIT_RETENTION_MS,
  rateLimitsRepo,
} from "../storage/rate-limits-repo.ts";
import { LAPSED_PRUNE_BATCH, shortLinksRepo } from "../storage/short-links-repo.ts";

const DAY_MS = 86_400_000;

export const LAPSED_RETENTION_MS = 30 * DAY_MS;
export const QUESTION_PRUNE_BATCH = 100;

type Chore = (store: Store, now: Date) => Promise<void>;

const CHORES: readonly (readonly [HousekeepingTask, Chore])[] = [
  [
    "rate_limits",
    async (store, now) => {
      await rateLimitsRepo(store).prune(
        new Date(now.getTime() - RATE_LIMIT_RETENTION_MS).toISOString(),
        RATE_LIMIT_PRUNE_BATCH,
      );
    },
  ],
  [
    "short_links",
    async (store, now) => {
      await shortLinksRepo(store).pruneLapsed(
        new Date(now.getTime() - LAPSED_RETENTION_MS).toISOString(),
        LAPSED_PRUNE_BATCH,
      );
    },
  ],
  [
    "questions",
    async (store, now) => {
      await questionsRepo(store).prune(retentionCutoffs(now), QUESTION_PRUNE_BATCH);
    },
  ],
];

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

export async function runHousekeeping(store: Store, now: Date): Promise<readonly unknown[]> {
  const failures: unknown[] = [];
  for (const [task, chore] of CHORES) {
    try {
      await chore(store, now);
    } catch (error) {
      logEvent({ event: "housekeeping_failed", task, errorName: errorName(error) });
      failures.push(error);
    }
  }
  return failures;
}
