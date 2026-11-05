import type { PanelShortLinkCursor } from "@zsm3/contracts/panel";
import { z } from "zod";

import { allRows, firstRow, timestamp, type SqlStatement, type Store } from "./database.ts";
import { uuidv7 } from "./ids.ts";
import { creationAudit, uniformChanges } from "./short-link-audit.ts";
import {
  authorLinkRowSchema,
  linkRowSchema,
  toAuthorRecord,
  toRecord,
  type AuthorShortLinkRecord,
  type ShortLinkRecord,
} from "./short-links-rows.ts";
import {
  AUDIT_SHORT_LINK_REVOKE,
  COUNT_CLICK,
  DELETE_LAPSED_SHORT_LINKS,
  INSERT_SHORT_LINK,
  REVOKE_SHORT_LINK,
  SELECT_AUTHOR_LINKS,
  SELECT_AUTHOR_LINKS_PAGE,
  SELECT_CODE_IN_USE,
  SELECT_CREATED_LINK,
  SELECT_SHORT_LINK,
} from "./short-links-sql.ts";
import type { PasswordDigest } from "../security/passwords.ts";

export type { AuthorShortLinkRecord, ShortLinkRecord } from "./short-links-rows.ts";
export { toRecord } from "./short-links-rows.ts";

export const LAPSED_PRUNE_BATCH = 500;
export const AUTHOR_LINK_LIMIT = 200;

const codeInUseSchema = z.strictObject({ taken: z.union([z.literal(0), z.literal(1)]) });

export interface NewShortLinkRow {
  readonly code: string;
  readonly target: string;
  readonly password: PasswordDigest | null;
  readonly createdBy: string;
  readonly expiresAt: string;
}

export interface ShortLinksRepo {
  create(row: NewShortLinkRow): Promise<void>;
  createAudited(row: NewShortLinkRow): Promise<void>;
  find(code: string): Promise<ShortLinkRecord | undefined>;
  inUse(code: string): Promise<boolean>;
  created(code: string, createdBy: string): Promise<AuthorShortLinkRecord>;
  countClick(code: string): Promise<void>;
  revoke(code: string, createdBy: string, at?: string): Promise<boolean>;
  byAuthor(createdBy: string, limit: number): Promise<readonly AuthorShortLinkRecord[]>;
  pageByAuthor(
    createdBy: string,
    cursor: PanelShortLinkCursor | null,
    limit: number,
  ): Promise<readonly AuthorShortLinkRecord[]>;
  pruneLapsed(cutoff: string, limit: number): Promise<void>;
}

function boundedAuthorLimit(limit: number): number {
  return Math.min(z.number().int().nonnegative().parse(limit), AUTHOR_LINK_LIMIT);
}

async function revokeLink(
  store: Store,
  code: string,
  createdBy: string,
  at: string,
): Promise<boolean> {
  const { db, random } = store;
  const result = await db.batch([
    db
      .prepare(AUDIT_SHORT_LINK_REVOKE)
      .bind(
        uuidv7(new Date(at).getTime(), random),
        at,
        createdBy,
        JSON.stringify({ revoked_at: at }),
        code,
      ),
    db.prepare(REVOKE_SHORT_LINK).bind(code, createdBy, at),
  ]);
  return uniformChanges(result, 2, "revoke");
}

function insertLink(store: Store, row: NewShortLinkRow): SqlStatement {
  return store.db
    .prepare(INSERT_SHORT_LINK)
    .bind(
      row.code,
      row.target,
      row.password?.salt ?? null,
      row.password?.hash ?? null,
      row.createdBy,
      timestamp(store.clock),
      row.expiresAt,
    );
}

async function createAudited(store: Store, row: NewShortLinkRow): Promise<void> {
  const audit = creationAudit(store, {
    code: row.code,
    createdBy: row.createdBy,
    kind: "url",
    passwordProtected: row.password !== null,
  });
  uniformChanges(await store.db.batch([insertLink(store, row), audit]), 2, "create");
}

async function authorPage(
  store: Store,
  createdBy: string,
  cursor: PanelShortLinkCursor | null,
  limit: number,
): Promise<readonly AuthorShortLinkRecord[]> {
  const statement = store.db
    .prepare(SELECT_AUTHOR_LINKS_PAGE)
    .bind(
      createdBy,
      cursor?.createdAt ?? null,
      cursor?.code ?? null,
      z.number().int().min(1).max(AUTHOR_LINK_LIMIT).parse(limit) + 1,
    );
  return (await allRows(statement, authorLinkRowSchema)).map(toAuthorRecord);
}

async function byAuthor(
  store: Store,
  createdBy: string,
  limit: number,
): Promise<readonly AuthorShortLinkRecord[]> {
  const statement = store.db
    .prepare(SELECT_AUTHOR_LINKS)
    .bind(createdBy, boundedAuthorLimit(limit));
  return (await allRows(statement, authorLinkRowSchema)).map(toAuthorRecord);
}

export function shortLinksRepo(store: Store): ShortLinksRepo {
  const { db, clock } = store;
  return {
    create: async (row) => {
      await insertLink(store, row).run();
    },
    createAudited: async (row) => createAudited(store, row),
    find: async (code) => {
      const row = await firstRow(db.prepare(SELECT_SHORT_LINK).bind(code), linkRowSchema);
      return row === undefined ? undefined : toRecord(row);
    },
    inUse: async (code) => {
      const row = await firstRow(db.prepare(SELECT_CODE_IN_USE).bind(code), codeInUseSchema);
      return row?.taken === 1;
    },
    created: async (code, createdBy) => {
      const row: unknown = await db.prepare(SELECT_CREATED_LINK).bind(code, createdBy).first();
      return toAuthorRecord(authorLinkRowSchema.parse(row));
    },
    countClick: async (code) => {
      await db.prepare(COUNT_CLICK).bind(code).run();
    },
    revoke: async (code, createdBy, at) =>
      revokeLink(store, code, createdBy, at ?? timestamp(clock)),
    byAuthor: async (createdBy, limit) => byAuthor(store, createdBy, limit),
    pageByAuthor: async (author, cursor, size) => authorPage(store, author, cursor, size),
    pruneLapsed: async (cutoff, limit) => {
      await db.prepare(DELETE_LAPSED_SHORT_LINKS).bind(cutoff, limit).run();
    },
  };
}
