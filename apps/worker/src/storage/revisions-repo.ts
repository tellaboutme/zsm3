import { z } from "zod";

import {
  allRows,
  firstRow,
  stored,
  timestamp,
  type SqlStatement,
  type Store,
  type WriteReceipt,
} from "./database.ts";
import { uuidv7 } from "./ids.ts";

export interface Revision {
  readonly id: string;
  readonly entity: string;
  readonly entityId: string;
  readonly revision: number;
  readonly dataJson: string;
  readonly actorEmail: string | null;
  readonly at: string;
}

export interface RevisionsRepo {
  append(entity: string, entityId: string, dataJson: string, actorEmail: string): Promise<void>;
  statement(entity: string, entityId: string, dataJson: string, actorEmail: string): SqlStatement;
  expectedWrite(revision: ExpectedRevision): WriteReceipt;
  current(entity: string, entityId: string): Promise<number>;
  latest(entity: string, entityId: string): Promise<Revision | undefined>;
  list(entity: string, entityId: string): Promise<readonly Revision[]>;
  recent(entity: string, entityId: string, limit: number): Promise<readonly Revision[]>;
  find(entity: string, entityId: string, revision: number): Promise<Revision | undefined>;
}

export interface ExpectedRevision {
  readonly entity: string;
  readonly entityId: string;
  readonly dataJson: string;
  readonly actorEmail: string;
  readonly expected: number;
}

export const APPEND_EXPECTED_REVISION = `INSERT INTO content_revisions
  (id, entity, entity_id, revision, data_json, actor_email, at) VALUES
  (?1, ?2, ?3, CASE WHEN (SELECT COALESCE(MAX(revision), 0) FROM content_revisions
    WHERE entity = ?2 AND entity_id = ?3) = ?7 THEN ?7 + 1 END, ?4, ?5, ?6)`;

export const APPEND_REVISION = `INSERT INTO content_revisions
  (id, entity, entity_id, revision, data_json, actor_email, at) VALUES
  (?1, ?2, ?3, (SELECT COALESCE(MAX(revision), 0) + 1 FROM content_revisions
    WHERE entity = ?2 AND entity_id = ?3), ?4, ?5, ?6)`;

const SELECT_LATEST = `SELECT id, entity, entity_id, revision, data_json, actor_email, at
  FROM content_revisions WHERE entity = ? AND entity_id = ? ORDER BY revision DESC LIMIT 1`;

const SELECT_CURRENT = `SELECT revision FROM content_revisions
  WHERE entity = ? AND entity_id = ? ORDER BY revision DESC LIMIT 1`;

const SELECT_STORED = `SELECT 1 AS stored FROM content_revisions
  WHERE id = ? AND entity = ? AND entity_id = ?`;

const SELECT_ALL = `SELECT id, entity, entity_id, revision, data_json, actor_email, at
  FROM content_revisions WHERE entity = ? AND entity_id = ? ORDER BY revision ASC`;

const SELECT_RECENT = `SELECT id, entity, entity_id, revision, data_json, actor_email, at
  FROM content_revisions WHERE entity = ? AND entity_id = ? ORDER BY revision DESC LIMIT ?`;

const SELECT_ONE = `SELECT id, entity, entity_id, revision, data_json, actor_email, at
  FROM content_revisions WHERE entity = ? AND entity_id = ? AND revision = ?`;

const revisionInputSchema = z.strictObject({
  entity: z.string().trim().min(1),
  entityId: z.string().trim().min(1).max(300),
  dataJson: z.string().min(1),
  actorEmail: z.string().trim().toLowerCase().min(1),
});

const revisionRowSchema = z.object({
  id: z.string(),
  entity: z.string(),
  entity_id: z.string(),
  revision: z.number().int().min(1),
  data_json: z.string(),
  actor_email: z.string().nullable(),
  at: z.string(),
});

const currentRowSchema = z.object({ revision: z.number().int().min(1) });

type RevisionRow = z.infer<typeof revisionRowSchema>;

export function revisionFromRow(row: RevisionRow): Revision {
  return {
    id: row.id,
    entity: row.entity,
    entityId: row.entity_id,
    revision: row.revision,
    dataJson: row.data_json,
    actorEmail: row.actor_email,
    at: row.at,
  };
}

function revisionStatement(
  store: Store,
  revision: Pick<
    z.infer<typeof revisionInputSchema>,
    "entity" | "entityId" | "dataJson" | "actorEmail"
  >,
): SqlStatement {
  const parsed = revisionInputSchema.parse(revision);
  return store.db
    .prepare(APPEND_REVISION)
    .bind(
      uuidv7(store.clock().getTime(), store.random),
      parsed.entity,
      parsed.entityId,
      parsed.dataJson,
      parsed.actorEmail,
      timestamp(store.clock),
    );
}

function expectedWrite(store: Store, revision: ExpectedRevision): WriteReceipt {
  const parsed = revisionInputSchema.parse({
    entity: revision.entity,
    entityId: revision.entityId,
    dataJson: revision.dataJson,
    actorEmail: revision.actorEmail,
  });
  const id = uuidv7(store.clock().getTime(), store.random);
  return {
    statement: store.db
      .prepare(APPEND_EXPECTED_REVISION)
      .bind(
        id,
        parsed.entity,
        parsed.entityId,
        parsed.dataJson,
        parsed.actorEmail,
        timestamp(store.clock),
        revision.expected,
      ),
    landed: async () =>
      stored(store.db.prepare(SELECT_STORED).bind(id, parsed.entity, parsed.entityId)),
  };
}

export function revisionsRepo(store: Store): RevisionsRepo {
  const { db } = store;
  const latest = async (entity: string, entityId: string): Promise<Revision | undefined> => {
    const row = await firstRow(db.prepare(SELECT_LATEST).bind(entity, entityId), revisionRowSchema);
    return row === undefined ? undefined : revisionFromRow(row);
  };
  return {
    append: async (entity, entityId, dataJson, actorEmail) => {
      await db.batch([revisionStatement(store, { entity, entityId, dataJson, actorEmail })]);
    },
    statement: (entity, entityId, dataJson, actorEmail) =>
      revisionStatement(store, { entity, entityId, dataJson, actorEmail }),
    expectedWrite: (revision) => expectedWrite(store, revision),
    current: async (entity, entityId) =>
      (await firstRow(db.prepare(SELECT_CURRENT).bind(entity, entityId), currentRowSchema))
        ?.revision ?? 0,
    latest,
    list: async (entity, entityId) =>
      (await allRows(db.prepare(SELECT_ALL).bind(entity, entityId), revisionRowSchema)).map(
        revisionFromRow,
      ),
    recent: async (entity, entityId, limit) =>
      (
        await allRows(db.prepare(SELECT_RECENT).bind(entity, entityId, limit), revisionRowSchema)
      ).map(revisionFromRow),
    find: async (entity, entityId, revision) => {
      const row = await firstRow(
        db.prepare(SELECT_ONE).bind(entity, entityId, revision),
        revisionRowSchema,
      );
      return row === undefined ? undefined : revisionFromRow(row);
    },
  };
}
