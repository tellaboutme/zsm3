import { z } from "zod";

import { SECRETS } from "./maintenance-harness.ts";
import {
  AUTHOR,
  fileStore,
  NOW,
  spyBucket,
  upload,
  uploadDeps,
} from "./short-link-files-support.ts";
import { PDF } from "./zip-fixtures.ts";
import type { MediaBucket } from "../../src/app-env.ts";
import type { MaintenanceEnv } from "../../src/jobs/retention.ts";
import { createFileLink } from "../../src/short-links/upload.ts";
import { allRows, type SqlDatabase, type Store } from "../../src/storage/database.ts";
import { shortLinkFailuresRepo } from "../../src/storage/short-link-failures-repo.ts";
import { shortLinkFilesRepo } from "../../src/storage/short-link-files-repo.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

export const AFTER_EXPIRY = new Date("2027-09-01T00:00:00.000Z");
export const ABANDONED_KEY = "s/019a0b6c-1d2e-7f30-8a41-b52c63d74e85";

export interface Scene {
  readonly store: Store;
  readonly bucket: ReturnType<typeof spyBucket>;
}

async function fileLink(scene: Scene): Promise<string> {
  const outcome = await createFileLink(uploadDeps(scene.store, scene.bucket), upload(PDF));
  if (outcome.kind !== "created") {
    throw new Error("fixture");
  }
  return outcome.code;
}

export async function scene(): Promise<Scene> {
  const current = { store: fileStore(), bucket: spyBucket() };
  const revoked = await fileLink(current);
  await fileLink(current);
  await shortLinksRepo(current.store).revoke(revoked, AUTHOR, NOW.toISOString());
  await shortLinkFilesRepo(current.store).reserve({
    objectKey: ABANDONED_KEY,
    name: "karta.pdf",
    format: "pdf",
    bytes: 10,
    createdBy: AUTHOR,
  });
  await current.bucket.put(ABANDONED_KEY, new ArrayBuffer(1));
  await current.store.db
    .prepare("INSERT INTO rate_limits (key_hash, window_started_at, count) VALUES (?1, ?2, 1)")
    .bind(new Uint8Array([1, 2]), NOW.toISOString())
    .run();
  await shortLinkFailuresRepo(current.store).reserve("k7mq4ra", NOW);
  return current;
}

const countSchema = z.strictObject({ n: z.number() });

const COUNTS = {
  short_links: "SELECT count(*) AS n FROM short_links",
  short_link_files: "SELECT count(*) AS n FROM short_link_files",
  rate_limits: "SELECT count(*) AS n FROM rate_limits",
  short_link_failures: "SELECT count(*) AS n FROM short_link_failures",
};

export async function leftovers(current: Scene): Promise<Record<string, number>> {
  const counts: Record<string, number> = { objects: current.bucket.keys().length };
  for (const [table, query] of Object.entries(COUNTS)) {
    const [row] = await allRows(current.store.db.prepare(query), countSchema);
    counts[table] = row?.n ?? 0;
  }
  const [removed] = await allRows(
    current.store.db.prepare("SELECT count(*) AS n FROM short_link_files WHERE removed_at IS NULL"),
    countSchema,
  );
  counts["filesKept"] = removed?.n ?? 0;
  return counts;
}

export const CLEAN = {
  objects: 0,
  short_links: 1,
  short_link_files: 1,
  rate_limits: 0,
  short_link_failures: 0,
  filesKept: 0,
};

export function withSecrets(current: Scene, bucket: MediaBucket = current.bucket): MaintenanceEnv {
  return { ...SECRETS, DB: current.store.db, MEDIA: bucket };
}

export function withoutSecrets(current: Scene): MaintenanceEnv {
  return { DB: current.store.db, MEDIA: current.bucket };
}

export function failingOn(db: SqlDatabase, fragment: string): SqlDatabase {
  return {
    prepare: (query) => {
      if (query.includes(fragment)) {
        throw new Error("d1 unavailable");
      }
      return db.prepare(query);
    },
    batch: async (statements) => db.batch(statements),
  };
}
