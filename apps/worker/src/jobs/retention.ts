import { retentionCutoffs } from "../domain/question-lifecycle.ts";
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
import { auditRepo, type AuditRepo } from "../storage/audit-repo.ts";
import { cronStateRepo } from "../storage/cron-state-repo.ts";
import type { SqlDatabase, Store } from "../storage/database.ts";
import { outboxRepo, type OutboxRepo } from "../storage/outbox-repo.ts";
import { questionsRepo } from "../storage/questions-repo.ts";
import {
  RATE_LIMIT_PRUNE_BATCH,
  RATE_LIMIT_RETENTION_MS,
  rateLimitsRepo,
} from "../storage/rate-limits-repo.ts";
import { requestsRepo, type RequestsRepo } from "../storage/requests-repo.ts";
import { LAPSED_PRUNE_BATCH, shortLinksRepo } from "../storage/short-links-repo.ts";

export const RETENTION_BATCH = 100;
export const RETENTION_BATCHES_PER_RUN = 10;

const DAY_MS = 86_400_000;
const YEAR_MS = 365 * DAY_MS;
const RETENTION_JOB = "retention";
export const LAPSED_RETENTION_MS = 30 * DAY_MS;
export const AUDIT_RETENTION_YEARS = 2;
export const QUESTION_PRUNE_BATCH = 100;

export interface MaintenanceEnv extends RequestsSecretEnv {
  readonly DB: SqlDatabase;
}

export interface MaintenanceDeps {
  readonly requests: RequestsRepo;
  readonly outbox: OutboxRepo;
  readonly audit: AuditRepo;
  readonly crypto: PiiCrypto;
  readonly sender: EmailSender;
  readonly config: RequestsConfig;
}

export interface RetentionCounters {
  readonly rejected: number;
  readonly erased: number;
  readonly deleted: number;
  readonly auditDeleted: number;
}

export interface MaintenanceResult extends RetentionCounters, DrainResult {}

export function maintenanceDeps(env: MaintenanceEnv, store: Store): MaintenanceDeps {
  const config = requestsConfig(env);
  return {
    requests: requestsRepo(store),
    outbox: outboxRepo(store),
    audit: auditRepo(store),
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
    auditDeleted: retained.auditDeleted,
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
  await shortLinksRepo(store).pruneLapsed(
    new Date(now.getTime() - LAPSED_RETENTION_MS).toISOString(),
    LAPSED_PRUNE_BATCH,
  );
  await questionsRepo(store).prune(retentionCutoffs(now), QUESTION_PRUNE_BATCH);
  const today = utcDate(now);
  if ((await cron.lastRunDate(RETENTION_JOB)) === today) {
    return { ...drained, rejected: 0, erased: 0, deleted: 0, auditDeleted: 0 };
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
    auditDeleted: retained.auditDeleted,
  };
}

async function runRetention(
  deps: MaintenanceDeps,
  now: Date,
): Promise<RetentionCounters & { readonly pending: boolean }> {
  let rejected = 0;
  let erased = 0;
  let deleted = 0;
  let auditDeleted = 0;
  for (let batch = 0; batch < RETENTION_BATCHES_PER_RUN; batch += 1) {
    const current = await runRetentionBatch(deps, now);
    rejected += current.rejected;
    erased += current.erased;
    deleted += current.deleted;
    auditDeleted += current.auditDeleted;
    if (!current.pending) return { rejected, erased, deleted, auditDeleted, pending: false };
  }
  return { rejected, erased, deleted, auditDeleted, pending: true };
}

async function runRetentionBatch(
  deps: MaintenanceDeps,
  now: Date,
): Promise<RetentionCounters & { readonly pending: boolean }> {
  const at = now.toISOString();
  const [inactive, closed, erased, auditDeleted] = await Promise.all([
    deps.requests.listInactive(daysAgo(now, OPEN_INACTIVITY_DAYS), RETENTION_BATCH),
    deps.requests.listClosedBefore(daysAgo(now, CLOSED_PII_RETENTION_DAYS), RETENTION_BATCH),
    deps.requests.listErasedBefore(yearsAgo(now, ANONYMOUS_RETENTION_YEARS), RETENTION_BATCH),
    deps.audit.pruneBefore(yearsAgo(now, AUDIT_RETENTION_YEARS), RETENTION_BATCH),
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
    auditDeleted,
    pending:
      auditDeleted === RETENTION_BATCH ||
      [inactive, closed, erased].some((rows) => rows.length === RETENTION_BATCH),
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

function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function daysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

function yearsAgo(now: Date, years: number): string {
  return new Date(now.getTime() - years * YEAR_MS).toISOString();
}
