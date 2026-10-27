import { shortCodeSchema, targetUrlSchema } from "@zsm3/contracts/short-links";
import { z } from "zod";

import { allRows, firstRow, timestamp, type Store } from "./database.ts";
import { bytesSchema } from "./requests-rows.ts";
import {
  COUNT_CLICK,
  DELETE_LAPSED_SHORT_LINKS,
  INSERT_SHORT_LINK,
  REVOKE_SHORT_LINK,
  SELECT_AUTHOR_LINKS,
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
  revoke(code: string, at: string): Promise<void>;
  byAuthor(createdBy: string, limit: number): Promise<readonly ShortLinkRecord[]>;
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

export function shortLinksRepo({ db, clock }: Store): ShortLinksRepo {
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
    revoke: async (code, at) => {
      await db.prepare(REVOKE_SHORT_LINK).bind(code, at).run();
    },
    byAuthor: async (createdBy, limit) =>
      (await allRows(db.prepare(SELECT_AUTHOR_LINKS).bind(createdBy, limit), linkRowSchema)).map(
        toRecord,
      ),
    pruneLapsed: async (cutoff, limit) => {
      await db.prepare(DELETE_LAPSED_SHORT_LINKS).bind(cutoff, limit).run();
    },
  };
}
