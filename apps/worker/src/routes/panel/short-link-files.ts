import { panelShortLinkCreatedSchema } from "@zsm3/contracts/panel";
import { MAX_LINK_FILE_BYTES } from "@zsm3/contracts/short-links";
import type { Context } from "hono";

import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse, type ProblemStatus } from "../../http/problem.ts";
import { submittedPassword } from "../../short-links/resolve.ts";
import { createFileLink, type UploadOutcome } from "../../short-links/upload.ts";

export const LINK_UPLOAD_PATH = "/api/panel/short-links/files";
export const LINK_UPLOAD_BODY_OVERHEAD = 64 * 1024;
export const MAX_LINK_UPLOAD_BODY_BYTES = MAX_LINK_FILE_BYTES + LINK_UPLOAD_BODY_OVERHEAD;

const FILE_FIELD = "file";
const PASSWORD_FIELD = "password";

type RefusedUpload = Exclude<UploadOutcome, { readonly kind: "created" }>;

const REFUSED_STATUS: Readonly<Record<RefusedUpload["kind"], ProblemStatus>> = {
  empty: 422,
  large: 413,
  unsupported: 415,
  invalid: 422,
  unavailable: 503,
  exhausted: 500,
  failed: 500,
};

interface UploadForm {
  readonly file: File;
  readonly password: string | undefined;
}

async function uploadForm(c: Context<AppEnv>): Promise<UploadForm | undefined> {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return undefined;
  }
  const file = form.get(FILE_FIELD);
  const password = form.get(PASSWORD_FIELD);
  if (!(file instanceof File) || (password !== null && typeof password !== "string")) {
    return undefined;
  }
  return { file, password: submittedPassword(password) };
}

export async function uploadLinkFile(c: Context<AppEnv>): Promise<Response> {
  const form = await uploadForm(c);
  if (form === undefined) {
    return problemResponse(c, 422);
  }
  const deps = requirePanelDeps(c);
  const email = requirePanelSession(c).email;
  const outcome = await createFileLink(
    {
      links: deps.repos.shortLinks,
      files: deps.repos.shortLinkFiles,
      bucket: deps.mediaBucket,
      random: deps.random,
      passwordKey: c.env.SHORT_LINK_KEY,
    },
    {
      name: form.file.name,
      bytes: await form.file.arrayBuffer(),
      password: form.password,
      createdBy: email,
      now: deps.clock(),
    },
  );
  if (outcome.kind !== "created") {
    return problemResponse(c, REFUSED_STATUS[outcome.kind]);
  }
  const item = await deps.repos.shortLinks.created(outcome.code, email);
  return c.json(panelShortLinkCreatedSchema.parse({ item }), 201);
}
