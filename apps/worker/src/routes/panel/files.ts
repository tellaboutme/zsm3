import {
  MAX_FILE_BYTES,
  mediaFormatSchema,
  mediaKey,
  storedFileSchema,
  type MediaFormat,
  type StoredFile,
} from "@zsm3/contracts/media";
import { panelFileListSchema } from "@zsm3/contracts/panel";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";

import { atomicWrite } from "./atomic.ts";
import { auditEntry } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelOrigin } from "./guards.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import { allRows } from "../../storage/database.ts";

export const PANEL_UPLOAD_PREFIX = "/api/panel/files";
export const UPLOAD_BODY_OVERHEAD = 64 * 1024;
export const MAX_UPLOAD_BODY_BYTES = MAX_FILE_BYTES + UPLOAD_BODY_OVERHEAD;

const FILES_LIST = "SELECT key, name, format, bytes FROM files ORDER BY created_at DESC LIMIT 500";
const FILE_FIELD = "file";

type UploadSize = "empty" | "large" | "ok";

export function uploadSize(bytes: number): UploadSize {
  if (bytes === 0) {
    return "empty";
  }
  return bytes > MAX_FILE_BYTES ? "large" : "ok";
}

function formatFrom(name: string): MediaFormat | undefined {
  const lowered = name.toLowerCase();
  const format = mediaFormatSchema.safeParse(lowered.slice(lowered.lastIndexOf(".") + 1));
  return format.success ? format.data : undefined;
}

function hexDigest(digest: ArrayBuffer): string {
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toLowerCase();
}

interface StoredUpload {
  readonly stored: StoredFile;
  readonly bytes: ArrayBuffer;
}

async function storeUpload(file: File): Promise<StoredUpload | undefined> {
  const format = formatFrom(file.name);
  if (format === undefined) {
    return undefined;
  }
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const candidate = storedFileSchema.safeParse({
    key: mediaKey(hexDigest(digest), format),
    name: file.name,
    format,
    bytes: bytes.byteLength,
  });
  return candidate.success ? { stored: candidate.data, bytes } : undefined;
}

async function formUpload(c: Context<AppEnv>): Promise<File | undefined> {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return undefined;
  }
  const entry = form.get(FILE_FIELD);
  return entry instanceof File ? entry : undefined;
}

async function listFiles(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const rows = await allRows(deps.db.prepare(FILES_LIST), storedFileSchema);
  return c.json(panelFileListSchema.parse({ items: rows }));
}

async function uploadFile(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const file = await formUpload(c);
  if (file === undefined) {
    return problemResponse(c, 422);
  }
  const size = uploadSize(file.size);
  if (size !== "ok") {
    return problemResponse(c, size === "large" ? 413 : 422);
  }
  const upload = await storeUpload(file);
  if (upload === undefined) {
    return problemResponse(c, 422);
  }
  await deps.mediaBucket.put(upload.stored.key, upload.bytes);
  await atomicWrite(deps, [
    deps.repos.files.saveStatement(upload.stored),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "files.create",
        entity: "files",
        entityId: upload.stored.key,
        fields: ["name"],
      }),
    ),
  ]);
  return c.json({ item: upload.stored }, 201);
}

export function filesRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/files", panelGuard("files.list"), panelOrigin, async (c) => listFiles(c))
    .post(
      "/files",
      panelGuard("files.upload"),
      panelOrigin,
      bodyLimit({ maxSize: MAX_UPLOAD_BODY_BYTES }),
      async (c) => uploadFile(c),
    );
}
