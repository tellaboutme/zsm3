import { z } from "zod";

import {
  ANONYMOUS_RETENTION_YEARS,
  CLOSED_PII_RETENTION_DAYS,
  OPEN_INACTIVITY_DAYS,
  retentionActions,
  type RetentionAction,
} from "../domain/retention-policy.ts";
import { requestsConfig, type RequestsConfig, type RequestsSecretEnv } from "../env.ts";
import { brevoSender } from "../mail/brevo-sender.ts";
import type { EmailSender } from "../mail/email-sender.ts";
import { drainOutbox, MAX_DRAIN, type DrainResult } from "../mail/outbox-consumer.ts";
import { piiCrypto, type PiiCrypto } from "../security/pii-crypto.ts";
import { firstRow, type SqlDatabase, type Store } from "../storage/database.ts";
import { outboxRepo, type OutboxRepo } from "../storage/outbox-repo.ts";
import {
  RATE_LIMIT_PRUNE_BATCH,
  RATE_LIMIT_RETENTION_MS,
  rateLimitsRepo,
} from "../storage/rate-limits-repo.ts";
import { requestsRepo, type RequestsRepo } from "../storage/requests-repo.ts";

export const RETENTION_BATCH = 100;
export const RETENTION_BATCHES_PER_RUN = 10;

const DAY_MS = 86_400_000;
const YEAR_MS = 365 * DAY_MS;
const RETENTION_JOB = "retention";

const SELECT_CRON_STATE = "SELECT last_run_date FROM cron_state WHERE job = ?";
const UPSERT_CRON_STATE = `INSERT INTO cron_state (job, last_run_date) VALUES (?1, ?2)
  ON CONFLICT (job) DO UPDATE SET last_run_date = excluded.last_run_date`;

export interface MaintenanceEnv extends RequestsSecretEnv {
  readonly DB: SqlDatabase;
}

export interface MaintenanceDeps {
  readonly requests: RequestsRepo;
  readonly outbox: OutboxRepo;
  readonly crypto: PiiCrypto;
  readonly sender: EmailSender;
  readonly config: RequestsConfig;
}

export interface RetentionCounters {
  readonly rejected: number;
  readonly erased: number;
  readonly deleted: number;
}

export interface MaintenanceResult extends RetentionCounters, DrainResult {}

interface CronStateRepo {
  lastRunDate(job: string): Promise<string | undefined>;
  markRunDate(job: string, date: string): Promise<void>;
}

export function maintenanceDeps(env: MaintenanceEnv, store: Store): MaintenanceDeps {
  const config = requestsConfig(env);
  return {
    requests: requestsRepo(store),
    outbox: outboxRepo(store),
    crypto: piiCrypto(config.piiKeys, config.activePiiKeyId, store.random),
    sender: brevoSender(config.brevoApiKey),
    config,
  };
}

export async function runMaintenance(deps: MaintenanceDeps, now: Date): Promise<MaintenanceResult> {
  const drained = await drainOutbox(deps, now, MAX_DRAIN);
  const retained = await runRetention(deps, now);
  return {
    ...drained,
    rejected: retained.rejected,
    erased: retained.erased,
    deleted: retained.deleted,
  };
}

export async function runScheduledMaintenance(
  env: MaintenanceEnv,
  store: Store,
  now: Date,
): Promise<MaintenanceResult> {
  const deps = maintenanceDeps(env, store);
  const drained = await drainOutbox(deps, now, MAX_DRAIN);
  const cron = cronStateRepo(store);
  await rateLimitsRepo(store).prune(
    new Date(now.getTime() - RATE_LIMIT_RETENTION_MS).toISOString(),
    RATE_LIMIT_PRUNE_BATCH,
  );
  const today = utcDate(now);
  if ((await cron.lastRunDate(RETENTION_JOB)) === today) {
    return { ...drained, rejected: 0, erased: 0, deleted: 0 };
  }
  const retained = await runRetention(deps, now);
  if (!retained.pending) {
    await cron.markRunDate(RETENTION_JOB, today);
  }
  return {
    ...drained,
    rejected: retained.rejected,
    erased: retained.erased,
    deleted: retained.deleted,
  };
}

async function runRetention(
  deps: MaintenanceDeps,
  now: Date,
): Promise<RetentionCounters & { readonly pending: boolean }> {
  let rejected = 0;
  let erased = 0;
  let deleted = 0;
  for (let batch = 0; batch < RETENTION_BATCHES_PER_RUN; batch += 1) {
    const current = await runRetentionBatch(deps, now);
    rejected += current.rejected;
    erased += current.erased;
    deleted += current.deleted;
    if (!current.pending) return { rejected, erased, deleted, pending: false };
  }
  return { rejected, erased, deleted, pending: true };
}

async function runRetentionBatch(
  deps: MaintenanceDeps,
  now: Date,
): Promise<RetentionCounters & { readonly pending: boolean }> {
  const at = now.toISOString();
  const [inactive, closed, erased] = await Promise.all([
    deps.requests.listInactive(daysAgo(now, OPEN_INACTIVITY_DAYS), RETENTION_BATCH),
    deps.requests.listClosedBefore(daysAgo(now, CLOSED_PII_RETENTION_DAYS), RETENTION_BATCH),
    deps.requests.listErasedBefore(yearsAgo(now, ANONYMOUS_RETENTION_YEARS), RETENTION_BATCH),
  ]);
  const actions = retentionActions(now, [...inactive, ...closed, ...erased]);
  const rejectIds = idsOf(actions, "reject");
  const eraseIds = idsOf(actions, "erase");
  const deleteIds = idsOf(actions, "delete");
  const rejected = await deps.requests.closeInactive(
    rejectIds,
    at,
    daysAgo(now, OPEN_INACTIVITY_DAYS),
  );
  if (eraseIds.length > 0) {
    await eraseClosed(deps, eraseIds, at);
  }
  if (deleteIds.length > 0) {
    await deps.requests.deleteErased(deleteIds);
  }
  return {
    rejected,
    erased: eraseIds.length,
    deleted: deleteIds.length,
    pending: [inactive, closed, erased].some((rows) => rows.length === RETENTION_BATCH),
  };
}

async function eraseClosed(
  deps: MaintenanceDeps,
  ids: readonly string[],
  at: string,
): Promise<void> {
  for (const id of ids) {
    await deps.requests.eraseAndCancel(id, at);
  }
}

function idsOf(actions: readonly RetentionAction[], kind: RetentionAction["kind"]): string[] {
  return actions.filter((action) => action.kind === kind).map((action) => action.requestId);
}

function cronStateRepo(store: Store): CronStateRepo {
  const { db } = store;
  return {
    lastRunDate: async (job) => {
      const row = await firstRow(
        db.prepare(SELECT_CRON_STATE).bind(job),
        z.strictObject({ last_run_date: z.string() }),
      );
      return row?.last_run_date;
    },
    markRunDate: async (job, date) => {
      await db.prepare(UPSERT_CRON_STATE).bind(job, date).run();
    },
  };
}

function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function daysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

function yearsAgo(now: Date, years: number): string {
  return new Date(now.getTime() - years * YEAR_MS).toISOString();
}
