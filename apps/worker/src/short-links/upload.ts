import { linkPasswordSchema, type LinkFileFormat } from "@zsm3/contracts/short-links";

import { digestFor, expiryAt, freeCode } from "./create.ts";
import type { MediaBucket } from "../app-env.ts";
import { inspectUpload, uploadSize } from "../domain/link-file.ts";
import { logEvent } from "../logging/log.ts";
import type { PasswordDigest } from "../security/passwords.ts";
import { uuidv7, type RandomBytes } from "../storage/ids.ts";
import type { ShortLinkFilesRepo } from "../storage/short-link-files-repo.ts";
import type { ShortLinksRepo } from "../storage/short-links-repo.ts";

export interface UploadDeps {
  readonly links: ShortLinksRepo;
  readonly files: ShortLinkFilesRepo;
  readonly bucket: MediaBucket;
  readonly random: RandomBytes;
  readonly passwordKey: string | undefined;
}

export interface UploadInput {
  readonly name: string;
  readonly bytes: ArrayBuffer;
  readonly password: string | undefined;
  readonly createdBy: string;
  readonly now: Date;
}

export type UploadOutcome =
  | { readonly kind: "created"; readonly code: string }
  | { readonly kind: "empty" }
  | { readonly kind: "large" }
  | { readonly kind: "unsupported" }
  | { readonly kind: "invalid" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "exhausted" }
  | { readonly kind: "failed" };

interface Prepared {
  readonly code: string;
  readonly name: string;
  readonly format: LinkFileFormat;
  readonly digest: PasswordDigest | null;
}

export function objectKeyFor(now: Date, random: RandomBytes): string {
  return `s/${uuidv7(now.getTime(), random)}`;
}

async function compensate(deps: UploadDeps, objectKey: string): Promise<void> {
  try {
    await deps.bucket.delete(objectKey);
    await deps.files.discard(objectKey);
  } catch (error) {
    logEvent({
      event: "short_link_file_cleanup_deferred",
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

async function prepare(deps: UploadDeps, input: UploadInput): Promise<Prepared | UploadOutcome> {
  const size = uploadSize(input.bytes.byteLength);
  if (size !== "ok") {
    return { kind: size };
  }
  const password =
    input.password === undefined ? undefined : linkPasswordSchema.safeParse(input.password);
  if (password?.success === false) {
    return { kind: "invalid" };
  }
  const verdict = inspectUpload(input.name, new Uint8Array(input.bytes));
  if (verdict.kind === "unsupported") {
    return verdict;
  }
  const digest = await digestFor(deps, password?.data);
  if (digest.kind === "unavailable") {
    return digest;
  }
  const code = await freeCode(deps);
  return code === undefined
    ? { kind: "exhausted" }
    : { code, name: verdict.name, format: verdict.format, digest: digest.digest };
}

async function store(deps: UploadDeps, input: UploadInput, prepared: Prepared): Promise<boolean> {
  const objectKey = objectKeyFor(input.now, deps.random);
  const { code, name, format } = prepared;
  const bytes = input.bytes.byteLength;
  await deps.files.reserve({ objectKey, name, format, bytes, createdBy: input.createdBy });
  try {
    await deps.bucket.put(objectKey, input.bytes);
    const attached = await deps.files.attach({
      code,
      objectKey,
      password: prepared.digest,
      createdBy: input.createdBy,
      expiresAt: expiryAt(input.now),
    });
    if (!attached) {
      await compensate(deps, objectKey);
    }
    return attached;
  } catch (error) {
    await compensate(deps, objectKey);
    throw error;
  }
}

export async function createFileLink(deps: UploadDeps, input: UploadInput): Promise<UploadOutcome> {
  const prepared = await prepare(deps, input);
  if ("kind" in prepared) {
    return prepared;
  }
  return (await store(deps, input, prepared))
    ? { kind: "created", code: prepared.code }
    : { kind: "failed" };
}
