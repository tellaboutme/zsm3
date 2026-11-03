import { linkFileContentTypes } from "@zsm3/contracts/short-links";
import { Hono, type Context } from "hono";

import type { AppEnv } from "../app-env.ts";
import { isFormBody } from "../http/form-body.ts";
import { attachmentDisposition, PRIVATE_DOWNLOAD } from "../http/media-headers.ts";
import { isOwnSubmission } from "../http/origin.ts";
import { problemResponse } from "../http/problem.ts";
import { passwordRedirect, submittedPassword, unlockLink } from "../short-links/resolve.ts";
import { liveStore } from "../storage/database.ts";
import { rateLimitsRepo } from "../storage/rate-limits-repo.ts";
import { shortLinksRepo } from "../storage/short-links-repo.ts";
import type { StoredLinkFile } from "../storage/short-links-rows.ts";

const FIELD_NAME = "haslo";

function backTo(c: Context<AppEnv>, location: string): Response {
  return c.body(null, 303, { Location: location });
}

async function download(c: Context<AppEnv>, file: StoredLinkFile, path: string): Promise<Response> {
  const object = await c.env.MEDIA.get(file.objectKey);
  if (object === null) {
    return backTo(c, `${path}?blad=plik`);
  }
  return c.body(object.body, 200, {
    "Content-Type": linkFileContentTypes[file.format],
    "Content-Length": String(object.size),
    "Content-Disposition": attachmentDisposition(file.name),
    "Cache-Control": PRIVATE_DOWNLOAD,
  });
}

export const shortLinkRoutes = new Hono<AppEnv>().post("/:code", async (c) => {
  if (!isOwnSubmission(c)) {
    return problemResponse(c, 403);
  }
  if (!isFormBody(c.req.header("Content-Type"))) {
    return problemResponse(c, 415);
  }
  const code = c.req.param("code");
  const path = `/s/${encodeURIComponent(code)}`;
  const store = liveStore(c.env.DB);
  const submitted = await c.req.parseBody();
  const deps = {
    links: shortLinksRepo(store),
    rateLimits: rateLimitsRepo(store),
    passwordKey: c.env.SHORT_LINK_KEY,
  };
  const outcome = await unlockLink(
    deps,
    code,
    submittedPassword(submitted[FIELD_NAME]),
    new Date(),
  );
  return outcome.kind === "file"
    ? await download(c, outcome.file, path)
    : backTo(c, passwordRedirect(outcome, path));
});
