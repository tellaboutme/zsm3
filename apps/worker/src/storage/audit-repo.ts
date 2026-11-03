import { z } from "zod";

import {
  allRows,
  batchChanges,
  stored,
  timestamp,
  type SqlStatement,
  type SqlValue,
  type Store,
  type WriteReceipt,
} from "./database.ts";
import { uuidv7 } from "./ids.ts";

export const MAX_AUDIT_LIMIT = 100;

export interface AuditEntry {
  readonly actorEmail: string | null;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string;
  readonly details: string;
}

export interface AuditRecord extends AuditEntry {
  readonly id: string;
  readonly at: string;
}

export interface AuditRepo {
  append(entry: AuditEntry): Promise<void>;
  statement(entry: AuditEntry): SqlStatement;
  receipt(entry: AuditEntry): WriteReceipt;
  list(limit: number): Promise<readonly AuditRecord[]>;
  byEntity(entity: string, entityId: string, limit: number): Promise<readonly AuditRecord[]>;
  before(at: string, id: string, limit: number): Promise<readonly AuditRecord[]>;
  pruneBefore(at: string, limit: number): Promise<number>;
}

const APPEND = `INSERT INTO audit_log (id, at, actor_email, action, entity, entity_id, details_json)
  VALUES (?, ?, ?, ?, ?, ?, ?)`;

const STORED = "SELECT 1 AS stored FROM audit_log WHERE id = ?";

const LIST = `SELECT id, at, actor_email, action, entity, entity_id, details_json FROM audit_log
  ORDER BY at DESC, id DESC LIMIT ?`;

const LIST_BY_ENTITY = `SELECT id, at, actor_email, action, entity, entity_id, details_json
  FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY at DESC, id DESC LIMIT ?`;

const LIST_BEFORE = `SELECT id, at, actor_email, action, entity, entity_id, details_json
  FROM audit_log WHERE (at, id) < (?, ?) ORDER BY at DESC, id DESC LIMIT ?`;

const PRUNE_BEFORE = `DELETE FROM audit_log WHERE id IN
  (SELECT id FROM audit_log WHERE at < ?1 ORDER BY at LIMIT ?2)`;

const auditEntrySchema = z.looseObject({
  actorEmail: z.string().trim().toLowerCase().nullable(),
  action: z.string().trim().min(1).max(100),
  entity: z.string().trim().min(1).max(100),
  entityId: z.string().trim().min(1).max(300),
  details: z.string().min(1),
});

const auditRowSchema = z.object({
  id: z.string(),
  at: z.string(),
  actor_email: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entity_id: z.string(),
  details_json: z.string(),
});

type AuditRow = z.infer<typeof auditRowSchema>;

export function auditFromRow(row: AuditRow): AuditRecord {
  return {
    id: row.id,
    at: row.at,
    actorEmail: row.actor_email,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    details: row.details_json,
  };
}

export function clampedLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), MAX_AUDIT_LIMIT);
}

export function auditValues(
  { clock, random }: Store,
  entry: AuditEntry,
  id = uuidv7(clock().getTime(), random),
): SqlValue[] {
  const parsed = auditEntrySchema.parse(entry);
  return [
    id,
    timestamp(clock),
    parsed.actorEmail,
    parsed.action,
    parsed.entity,
    parsed.entityId,
    parsed.details,
  ];
}

function auditStatement(store: Store, entry: AuditEntry): SqlStatement {
  return store.db.prepare(APPEND).bind(...auditValues(store, entry));
}

function auditReceipt(store: Store, entry: AuditEntry): WriteReceipt {
  const id = uuidv7(store.clock().getTime(), store.random);
  return {
    statement: store.db.prepare(APPEND).bind(...auditValues(store, entry, id)),
    landed: async () => stored(store.db.prepare(STORED).bind(id)),
  };
}

export function auditRepo(store: Store): AuditRepo {
  const { db } = store;
  const read = async (
    query: string,
    ...values: readonly SqlValue[]
  ): Promise<readonly AuditRecord[]> =>
    (await allRows(db.prepare(query).bind(...values), auditRowSchema)).map(auditFromRow);
  return {
    append: async (entry) => {
      await db.batch([auditStatement(store, entry)]);
    },
    statement: (entry) => auditStatement(store, entry),
    receipt: (entry) => auditReceipt(store, entry),
    list: async (limit) => read(LIST, clampedLimit(limit)),
    byEntity: async (entity, entityId, limit) =>
      read(LIST_BY_ENTITY, entity, entityId, clampedLimit(limit)),
    before: async (at, id, limit) => read(LIST_BEFORE, at, id, clampedLimit(limit)),
    pruneBefore: async (at, limit) => {
      const changes = batchChanges(await db.batch([db.prepare(PRUNE_BEFORE).bind(at, limit)]));
      return changes.reduce((total, count) => total + count, 0);
    },
  };
}
