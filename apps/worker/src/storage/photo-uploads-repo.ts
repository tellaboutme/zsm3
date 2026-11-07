import { z } from "zod";

import {
  allRows,
  batchChanges,
  firstRow,
  timestamp,
  type SqlStatement,
  type Store,
} from "./database.ts";

export const UPLOAD_LEASE_MS = 300_000;

const BEGIN_UPLOAD = `INSERT INTO photo_uploads (sha256, started_at) VALUES (?1, ?2)
  ON CONFLICT (sha256) DO UPDATE SET started_at = excluded.started_at
  WHERE photo_uploads.claimed_at IS NULL AND photo_uploads.started_at < ?3
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

const SELECT_EXPIRED = `SELECT e.id, e.sha256 FROM (
    SELECT p.id, p.sha256 FROM photos p WHERE p.deleted_at < ?1
    UNION
    SELECT p.id, p.sha256 FROM albums a JOIN photos p ON p.album_id = a.id WHERE a.deleted_at < ?1
  ) e
  WHERE NOT EXISTS (SELECT 1 FROM photo_uploads j WHERE j.sha256 = e.sha256)
  ORDER BY e.id LIMIT ?2`;

const CLAIM_EXPIRED = `INSERT INTO photo_uploads (sha256, started_at, claimed_at)
  SELECT p.sha256, ?2, ?2 FROM photos p JOIN albums a ON a.id = p.album_id
  WHERE p.sha256 = ?1 AND (p.deleted_at < ?3 OR a.deleted_at < ?3)
  AND NOT EXISTS (SELECT 1 FROM photo_uploads j WHERE j.sha256 = p.sha256)`;

const DELETE_EXPIRED = `DELETE FROM photos WHERE sha256 = ?1 AND EXISTS
  (SELECT 1 FROM photo_uploads j WHERE j.sha256 = ?1 AND j.claimed_at IS NOT NULL)`;

const DELETE_EMPTY_ALBUMS = `DELETE FROM albums WHERE id IN (SELECT a.id FROM albums a
  WHERE a.deleted_at < ?1 AND NOT EXISTS (SELECT 1 FROM photos p WHERE p.album_id = a.id)
  ORDER BY a.id LIMIT ?2)`;

const hashRowSchema = z.strictObject({ sha256: z.string() });
const expiredRowSchema = z.strictObject({ id: z.string(), sha256: z.string() });

export interface ExpiredPhoto {
  readonly id: string;
  readonly sha256: string;
}

export interface PhotoUploadsRepo {
  begin(sha256: string): Promise<boolean>;
  finishStatement(sha256: string): SqlStatement;
  releaseSaved(cutoff: string): Promise<void>;
  claimAbandoned(cutoff: string): Promise<void>;
  claimed(limit: number): Promise<readonly string[]>;
  forgetClaimed(sha256: string): Promise<void>;
  expired(cutoff: string, limit: number): Promise<readonly ExpiredPhoto[]>;
  retireExpired(sha256: string, cutoff: string): Promise<boolean>;
  removeEmptyAlbums(cutoff: string, limit: number): Promise<void>;
}

export function photoUploadsRepo({ db, clock }: Store): PhotoUploadsRepo {
  return {
    begin: async (sha256) => {
      const leaseEnded = new Date(clock().getTime() - UPLOAD_LEASE_MS).toISOString();
      const query = db.prepare(BEGIN_UPLOAD).bind(sha256, timestamp(clock), leaseEnded);
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
    expired: async (cutoff, limit) =>
      allRows(db.prepare(SELECT_EXPIRED).bind(cutoff, limit), expiredRowSchema),
    retireExpired: async (sha256, cutoff) => {
      const changes = batchChanges(
        await db.batch([
          db.prepare(CLAIM_EXPIRED).bind(sha256, timestamp(clock), cutoff),
          db.prepare(DELETE_EXPIRED).bind(sha256),
        ]),
      );
      return changes.at(1) === 1;
    },
    removeEmptyAlbums: async (cutoff, limit) => {
      await db.prepare(DELETE_EMPTY_ALBUMS).bind(cutoff, limit).run();
    },
  };
}
