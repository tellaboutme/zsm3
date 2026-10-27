import { emailKindSchema, type EmailKind } from "@zsm3/contracts/requests";
import { z } from "zod";

import { firstRow, timestamp, type Store } from "./database.ts";
import { uuidv7 } from "./ids.ts";
import {
  DELETE_FAILURES_FOR_REQUEST,
  DELETE_OUTBOX_FOR_REQUEST,
  CLAIM_DUE,
  INSERT_FAILURE,
  INSERT_OUTBOX,
  MARK_DEAD,
  MARK_RETRY,
  MARK_SENT,
  SELECT_DUE,
  SELECT_CLAIM,
  SELECT_ACTIVE_CLAIM,
} from "./outbox-sql.ts";

export const MAX_OUTBOX_ATTEMPTS = 5;
export const OUTBOX_LEASE_MS = 120_000;

export interface OutboxRow {
  readonly id: string;
  readonly kind: EmailKind;
  readonly requestId: string;
  readonly origin: string | null;
  readonly attempts: number;
  readonly nextAttemptAt: string;
  readonly sentAt: string | null;
  readonly failedAt: string | null;
  readonly leaseOwner: string | null;
  readonly leaseUntil: string | null;
}

export interface OutboxDraft {
  readonly kind: EmailKind;
  readonly requestId: string;
  readonly origin: string | null;
}

export type FailureOutcome = "retried" | "dead" | "stale";

const outboxRowSchema = z.strictObject({
  id: z.string(),
  kind: emailKindSchema,
  request_id: z.string(),
  origin: z.string().nullable(),
  attempts: z.number().int(),
  next_attempt_at: z.string(),
  sent_at: z.string().nullable(),
  failed_at: z.string().nullable(),
  lease_owner: z.string().nullable(),
  lease_until: z.string().nullable(),
});

type OutboxSqlRow = z.infer<typeof outboxRowSchema>;

function toRow(row: OutboxSqlRow): OutboxRow {
  return {
    id: row.id,
    kind: row.kind,
    requestId: row.request_id,
    origin: row.origin,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    sentAt: row.sent_at,
    failedAt: row.failed_at,
    leaseOwner: row.lease_owner,
    leaseUntil: row.lease_until,
  };
}

export interface OutboxRepo {
  enqueue(drafts: readonly OutboxDraft[]): Promise<void>;
  due(now: string, limit: number): Promise<readonly OutboxRow[]>;
  claim(now: Date, limit: number): Promise<readonly OutboxRow[]>;
  active(row: OutboxRow): Promise<boolean>;
  markSent(row: OutboxRow): Promise<boolean>;
  markFailed(row: OutboxRow, errorCode: string): Promise<FailureOutcome>;
  deleteForRequest(requestId: string): Promise<void>;
}

async function enqueueDrafts(store: Store, drafts: readonly OutboxDraft[]): Promise<void> {
  const { db, clock } = store;
  const now = timestamp(clock);
  await db.batch(
    drafts.map((draft) =>
      db
        .prepare(INSERT_OUTBOX)
        .bind(
          uuidv7(clock().getTime(), store.random),
          draft.kind,
          draft.requestId,
          draft.origin,
          now,
        ),
    ),
  );
}

async function markSentAt(store: Store, row: OutboxRow): Promise<boolean> {
  if (row.leaseOwner === null) return false;
  const updated = await firstRow(
    store.db.prepare(MARK_SENT).bind(timestamp(store.clock), row.id, row.leaseOwner),
    z.object({ id: z.string() }),
  );
  return updated !== undefined;
}

async function failRow(store: Store, row: OutboxRow, errorCode: string): Promise<FailureOutcome> {
  const { db, clock } = store;
  if (
    row.leaseOwner === null ||
    (await firstRow(
      db.prepare(SELECT_CLAIM).bind(row.id, row.leaseOwner),
      z.object({ id: z.string() }),
    )) === undefined
  )
    return "stale";
  const now = timestamp(clock);
  const attempts = row.attempts + 1;
  if (attempts >= MAX_OUTBOX_ATTEMPTS) {
    await db.batch([
      db
        .prepare(INSERT_FAILURE)
        .bind(uuidv7(clock().getTime(), store.random), errorCode, now, row.id, row.leaseOwner),
      db.prepare(MARK_DEAD).bind(now, row.id, row.leaseOwner),
    ]);
    return "dead";
  }
  const nextAttemptAt = new Date(clock().getTime() + 2 ** attempts * 60_000).toISOString();
  await db.prepare(MARK_RETRY).bind(nextAttemptAt, row.id, row.leaseOwner).run();
  return "retried";
}

async function deleteRequestRows(db: Store["db"], requestId: string): Promise<void> {
  await db.batch([
    db.prepare(DELETE_OUTBOX_FOR_REQUEST).bind(requestId),
    db.prepare(DELETE_FAILURES_FOR_REQUEST).bind(requestId),
  ]);
}

export function outboxRepo(store: Store): OutboxRepo {
  const { db } = store;

  return {
    enqueue: async (drafts) => enqueueDrafts(store, drafts),
    due: async (now, limit) => {
      const rows = await db.prepare(SELECT_DUE).bind(now, limit).all();
      return rows.results.map((row) => toRow(outboxRowSchema.parse(row)));
    },
    claim: async (now, limit) => {
      const leaseOwner = uuidv7(now.getTime(), store.random);
      const leaseUntil = new Date(now.getTime() + OUTBOX_LEASE_MS).toISOString();
      const rows = await db
        .prepare(CLAIM_DUE)
        .bind(now.toISOString(), leaseOwner, leaseUntil, limit)
        .all();
      return rows.results.map((row) => toRow(outboxRowSchema.parse(row)));
    },
    active: async (row) =>
      row.leaseOwner !== null &&
      (await firstRow(
        db.prepare(SELECT_ACTIVE_CLAIM).bind(row.id, row.leaseOwner, timestamp(store.clock)),
        z.object({ id: z.string() }),
      )) !== undefined,
    markSent: async (row) => markSentAt(store, row),
    markFailed: async (row, errorCode) => failRow(store, row, errorCode),
    deleteForRequest: async (requestId) => deleteRequestRows(db, requestId),
  };
}
