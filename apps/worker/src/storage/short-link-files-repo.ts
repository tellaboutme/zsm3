import type { LinkFile } from "@zsm3/contracts/short-links";
import { z } from "zod";

import { allRows, timestamp, type Store } from "./database.ts";
import { creationAudit, uniformChanges } from "./short-link-audit.ts";
import { linkObjectKeySchema } from "./short-links-rows.ts";
import {
  ATTACH_SHORT_LINK_FILE,
  DELETE_DETACHED_FILES,
  DISCARD_PENDING_FILE,
  INSERT_FILE_SHORT_LINK,
  INSERT_PENDING_FILE,
  MARK_FILE_REMOVED,
  SELECT_STALE_FILES,
} from "./short-links-sql.ts";
import type { PasswordDigest } from "../security/passwords.ts";

export const STALE_FILE_BATCH = 50;

export interface PendingLinkFile extends LinkFile {
  readonly objectKey: string;
  readonly createdBy: string;
}

export interface NewFileLinkRow {
  readonly code: string;
  readonly objectKey: string;
  readonly password: PasswordDigest | null;
  readonly createdBy: string;
  readonly expiresAt: string;
}

export interface StaleFilesQuery {
  readonly pendingBefore: string;
  readonly now: string;
  readonly limit: number;
}

export interface ShortLinkFilesRepo {
  reserve(file: PendingLinkFile): Promise<void>;
  attach(row: NewFileLinkRow): Promise<boolean>;
  discard(objectKey: string): Promise<void>;
  stale(query: StaleFilesQuery): Promise<readonly string[]>;
  markRemoved(objectKey: string, at: string): Promise<void>;
  forgetDetached(): Promise<void>;
}

const staleRowSchema = z.strictObject({ object_key: linkObjectKeySchema });

async function attach(store: Store, row: NewFileLinkRow): Promise<boolean> {
  const { db } = store;
  const result = await db.batch([
    db
      .prepare(INSERT_FILE_SHORT_LINK)
      .bind(
        row.code,
        row.password?.salt ?? null,
        row.password?.hash ?? null,
        row.createdBy,
        timestamp(store.clock),
        row.expiresAt,
        row.objectKey,
      ),
    db.prepare(ATTACH_SHORT_LINK_FILE).bind(row.code, row.objectKey, row.createdBy),
    creationAudit(store, {
      code: row.code,
      createdBy: row.createdBy,
      kind: "file",
      passwordProtected: row.password !== null,
    }),
  ]);
  return uniformChanges(result, 3, "file");
}

export function shortLinkFilesRepo(store: Store): ShortLinkFilesRepo {
  const { db, clock } = store;
  return {
    reserve: async (file) => {
      const key = linkObjectKeySchema.parse(file.objectKey);
      await db
        .prepare(INSERT_PENDING_FILE)
        .bind(key, file.name, file.format, file.bytes, file.createdBy, timestamp(clock))
        .run();
    },
    attach: async (row) => attach(store, row),
    discard: async (objectKey) => {
      await db.prepare(DISCARD_PENDING_FILE).bind(objectKey).run();
    },
    stale: async ({ pendingBefore, now, limit }) => {
      const statement = db.prepare(SELECT_STALE_FILES).bind(pendingBefore, now, limit);
      return (await allRows(statement, staleRowSchema)).map((row) => row.object_key);
    },
    markRemoved: async (objectKey, at) => {
      await db.prepare(MARK_FILE_REMOVED).bind(objectKey, at).run();
    },
    forgetDetached: async () => {
      await db.prepare(DELETE_DETACHED_FILES).run();
    },
  };
}
