import { z } from "zod";

import { allRows, firstRow, timestamp, type SqlStatement, type Store } from "./database.ts";

const BEGIN_UPLOAD = `INSERT INTO photo_uploads (sha256, started_at) VALUES (?1, ?2)
  ON CONFLICT (sha256) DO UPDATE SET started_at = excluded.started_at
  WHERE photo_uploads.claimed_at IS NULL
  RETURNING sha256`;

const FINISH_UPLOAD = "DELETE FROM photo_uploads WHERE sha256 = ?";

const RELEASE_SAVED = `DELETE FROM photo_uploads WHERE started_at < ?1
  AND EXISTS (SELECT 1 FROM photos WHERE photos.sha256 = photo_uploads.sha256)`;

const CLAIM_ABANDONED = `UPDATE photo_uploads SET claimed_at = ?1
  WHERE claimed_at IS NULL AND started_at < ?2
  AND NOT EXISTS (SELECT 1 FROM photos WHERE photos.sha256 = photo_uploads.sha256)`;

const SELECT_CLAIMED = `SELECT sha256 FROM photo_uploads WHERE claimed_at IS NOT NULL
  ORDER BY claimed_at, sha256 LIMIT ?`;

const FORGET_CLAIMED = "DELETE FROM photo_uploads WHERE sha256 = ? AND claimed_at IS NOT NULL";

const hashRowSchema = z.strictObject({ sha256: z.string() });

export interface PhotoUploadsRepo {
  begin(sha256: string): Promise<boolean>;
  finishStatement(sha256: string): SqlStatement;
  releaseSaved(cutoff: string): Promise<void>;
  claimAbandoned(cutoff: string): Promise<void>;
  claimed(limit: number): Promise<readonly string[]>;
  forgetClaimed(sha256: string): Promise<void>;
}

export function photoUploadsRepo({ db, clock }: Store): PhotoUploadsRepo {
  return {
    begin: async (sha256) => {
      const query = db.prepare(BEGIN_UPLOAD).bind(sha256, timestamp(clock));
      return (await firstRow(query, hashRowSchema)) !== undefined;
    },
    finishStatement: (sha256) => db.prepare(FINISH_UPLOAD).bind(sha256),
    releaseSaved: async (cutoff) => {
      await db.prepare(RELEASE_SAVED).bind(cutoff).run();
    },
    claimAbandoned: async (cutoff) => {
      await db.prepare(CLAIM_ABANDONED).bind(timestamp(clock), cutoff).run();
    },
    claimed: async (limit) => {
      const rows = await allRows(db.prepare(SELECT_CLAIMED).bind(limit), hashRowSchema);
      return rows.map((row) => row.sha256);
    },
    forgetClaimed: async (sha256) => {
      await db.prepare(FORGET_CLAIMED).bind(sha256).run();
    },
  };
}
