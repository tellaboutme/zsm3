import type { PanelShortLinkCursor } from "@zsm3/contracts/panel";
import { shortCodeSchema, targetUrlSchema } from "@zsm3/contracts/short-links";
import { z } from "zod";

import {
  allRows,
  batchChanges,
  firstRow,
  timestamp,
  type SqlDatabase,
  type Store,
} from "./database.ts";
import { uuidv7 } from "./ids.ts";
import { bytesSchema } from "./requests-rows.ts";
import {
  AUDIT_SHORT_LINK_REVOKE,
  COUNT_CLICK,
  DELETE_LAPSED_SHORT_LINKS,
  INSERT_SHORT_LINK,
  REVOKE_SHORT_LINK,
  SELECT_AUTHOR_LINKS,
  SELECT_AUTHOR_LINKS_PAGE,
  SELECT_SHORT_LINK,
} from "./short-links-sql.ts";
import type { LinkWindow } from "../domain/short-link.ts";
import type { PasswordDigest } from "../security/passwords.ts";

export const LAPSED_PRUNE_BATCH = 500;
export const AUTHOR_LINK_LIMIT = 200;

export interface ShortLinkRecord extends LinkWindow {
  readonly code: string;
  readonly target: string;
  readonly password: PasswordDigest | null;
}

export interface AuthorShortLinkRecord extends LinkWindow {
  readonly code: string;
  readonly target: string;
  readonly createdAt: string;
  readonly clicks: number;
  readonly passwordProtected: boolean;
}

export interface NewShortLinkRow {
  readonly code: string;
  readonly target: string;
  readonly password: PasswordDigest | null;
  readonly createdBy: string;
  readonly expiresAt: string;
}

export interface ShortLinksRepo {
  create(row: NewShortLinkRow): Promise<void>;
  find(code: string): Promise<ShortLinkRecord | undefined>;
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

const linkRowSchema = z.strictObject({
  code: shortCodeSchema,
  target_url: targetUrlSchema,
  password_salt: bytesSchema.nullable(),
  password_hash: bytesSchema.nullable(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
});

const authorLinkRowSchema = z.strictObject({
  code: shortCodeSchema,
  target_url: targetUrlSchema,
  created_at: z.string(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
  clicks: z.number().int().nonnegative(),
  password_protected: z.union([z.literal(0), z.literal(1)]),
});

type LinkRow = z.infer<typeof linkRowSchema>;

export function toRecord(row: LinkRow): ShortLinkRecord {
  const { password_salt: salt, password_hash: hash } = row;
  const password = salt === null || hash === null ? null : { salt, hash };
  return {
    code: row.code,
    target: row.target_url,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    password,
  };
}

function toAuthorRecord(row: z.infer<typeof authorLinkRowSchema>): AuthorShortLinkRecord {
  return {
    code: row.code,
    target: row.target_url,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    clicks: row.clicks,
    passwordProtected: row.password_protected === 1,
  };
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
  const changes = batchChanges(result);
  if (changes.length !== 2 || changes[0] !== changes[1] || (changes[0] !== 0 && changes[0] !== 1)) {
    throw new Error("Inconsistent short link revoke batch");
  }
  return changes[0] === 1;
}

async function authorPage(
  db: SqlDatabase,
  createdBy: string,
  cursor: PanelShortLinkCursor | null,
  limit: number,
): Promise<readonly AuthorShortLinkRecord[]> {
  const rows = await allRows(
    db
      .prepare(SELECT_AUTHOR_LINKS_PAGE)
      .bind(
        createdBy,
        cursor?.createdAt ?? null,
        cursor?.code ?? null,
        z.number().int().min(1).max(AUTHOR_LINK_LIMIT).parse(limit) + 1,
      ),
    authorLinkRowSchema,
  );
  return rows.map(toAuthorRecord);
}

export function shortLinksRepo(store: Store): ShortLinksRepo {
  const { db, clock } = store;
  return {
    create: async (row) => {
      await db
        .prepare(INSERT_SHORT_LINK)
        .bind(
          row.code,
          row.target,
          row.password?.salt ?? null,
          row.password?.hash ?? null,
          row.createdBy,
          timestamp(clock),
          row.expiresAt,
        )
        .run();
    },
    find: async (code) => {
      const row = await firstRow(db.prepare(SELECT_SHORT_LINK).bind(code), linkRowSchema);
      return row === undefined ? undefined : toRecord(row);
    },
    countClick: async (code) => {
      await db.prepare(COUNT_CLICK).bind(code).run();
    },
    revoke: async (code, createdBy, at) =>
      revokeLink(store, code, createdBy, at ?? timestamp(clock)),
    byAuthor: async (createdBy, limit) =>
      (
        await allRows(
          db.prepare(SELECT_AUTHOR_LINKS).bind(createdBy, boundedAuthorLimit(limit)),
          authorLinkRowSchema,
        )
      ).map(toAuthorRecord),
    pageByAuthor: async (author, cursor, size) => await authorPage(db, author, cursor, size),
    pruneLapsed: async (cutoff, limit) => {
      await db.prepare(DELETE_LAPSED_SHORT_LINKS).bind(cutoff, limit).run();
    },
  };
}
