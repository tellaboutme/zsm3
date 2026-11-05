import { z } from "zod";

import { counterRandom, memoryDatabase } from "./memory-database.ts";
import { memoryBucket } from "./panel-support.ts";
import type { MediaBucket } from "../../src/app-env.ts";
import type { ResolveDeps } from "../../src/short-links/resolve.ts";
import type { UploadDeps, UploadInput } from "../../src/short-links/upload.ts";
import { allRows, type Store } from "../../src/storage/database.ts";
import { cryptoRandom, type RandomBytes } from "../../src/storage/ids.ts";
import { rateLimitsRepo } from "../../src/storage/rate-limits-repo.ts";
import { shortLinkFailuresRepo } from "../../src/storage/short-link-failures-repo.ts";
import { shortLinkFilesRepo } from "../../src/storage/short-link-files-repo.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

export const KEY = "short-link-pepper-0123456789-0123456789";
export const AUTHOR = "nauczyciel@zespolszkolmechanicznych.edu.pl";
export const NOW = new Date("2026-11-03T09:00:00.000Z");

export interface BucketSpy extends MediaBucket {
  readonly keys: () => readonly string[];
  readonly deleted: string[];
}

export function spyBucket(base: MediaBucket = memoryBucket()): BucketSpy {
  const present = new Set<string>();
  const deleted: string[] = [];
  return {
    get: async (key) => base.get(key),
    put: async (key, value) => {
      present.add(key);
      return base.put(key, value);
    },
    delete: async (key) => {
      present.delete(key);
      deleted.push(key);
      await base.delete(key);
    },
    keys: () => [...present],
    deleted,
  };
}

export function fileStore(random: RandomBytes = counterRandom()): Store {
  return { db: memoryDatabase(), clock: () => NOW, random };
}

export function randomFileStore(): Store {
  return fileStore(cryptoRandom);
}

export function uploadDeps(
  store: Store,
  bucket: MediaBucket,
  key: string | undefined = KEY,
): UploadDeps {
  return {
    links: shortLinksRepo(store),
    files: shortLinkFilesRepo(store),
    bucket,
    random: store.random,
    passwordKey: key,
  };
}

export function resolveDeps(store: Store, key: string | undefined = KEY): ResolveDeps {
  return {
    links: shortLinksRepo(store),
    rateLimits: rateLimitsRepo(store),
    failures: shortLinkFailuresRepo(store),
    passwordKey: key,
  };
}

export function upload(bytes: Uint8Array, overrides: Partial<UploadInput> = {}): UploadInput {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return {
    name: "karta.pdf",
    bytes: copy.buffer,
    password: undefined,
    createdBy: AUTHOR,
    now: NOW,
    ...overrides,
  };
}

const fileRowSchema = z.strictObject({
  object_key: z.string(),
  code: z.string().nullable(),
  removed_at: z.string().nullable(),
});

export async function fileRows(store: Store): Promise<readonly z.infer<typeof fileRowSchema>[]> {
  return allRows(
    store.db.prepare(
      "SELECT object_key, code, removed_at FROM short_link_files ORDER BY created_at",
    ),
    fileRowSchema,
  );
}

export async function linkCount(store: Store): Promise<number> {
  const rows = await allRows(
    store.db.prepare("SELECT COUNT(*) AS count FROM short_links"),
    z.strictObject({ count: z.number() }),
  );
  return rows[0]?.count ?? 0;
}
