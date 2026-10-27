import { z } from "zod";

import { allRows, firstRow, timestamp, type SqlStatement, type Store } from "./database.ts";
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
  latest(entity: string, entityId: string): Promise<Revision | undefined>;
  list(entity: string, entityId: string): Promise<readonly Revision[]>;
  recent(entity: string, entityId: string, limit: number): Promise<readonly Revision[]>;
  find(entity: string, entityId: string, revision: number): Promise<Revision | undefined>;
}

export const APPEND_REVISION = `INSERT INTO content_revisions
  (id, entity, entity_id, revision, data_json, actor_email, at) VALUES
  (?1, ?2, ?3, (SELECT COALESCE(MAX(revision), 0) + 1 FROM content_revisions
    WHERE entity = ?2 AND entity_id = ?3), ?4, ?5, ?6)`;

const SELECT_LATEST = `SELECT id, entity, entity_id, revision, data_json, actor_email, at
  FROM content_revisions WHERE entity = ? AND entity_id = ? ORDER BY revision DESC LIMIT 1`;

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

export function revisionsRepo(store: Store): RevisionsRepo {
  const { db } = store;
  return {
    append: async (entity, entityId, dataJson, actorEmail) => {
      await db.batch([revisionStatement(store, { entity, entityId, dataJson, actorEmail })]);
    },
    statement: (entity, entityId, dataJson, actorEmail) =>
      revisionStatement(store, { entity, entityId, dataJson, actorEmail }),
    latest: async (entity, entityId) => {
      const row = await firstRow(
        db.prepare(SELECT_LATEST).bind(entity, entityId),
        revisionRowSchema,
      );
      return row === undefined ? undefined : revisionFromRow(row);
    },
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
