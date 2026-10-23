import { mediaContentTypes, mediaKeySchema } from "@zsm3/contracts/media";
import { Hono } from "hono";

import type { AppEnv } from "../app-env.ts";
import { contentDisposition, IMMUTABLE } from "../http/media-headers.ts";
import { problemResponse } from "../http/problem.ts";
import { liveStore } from "../storage/database.ts";
import { filesRepo } from "../storage/files-repo.ts";

export const mediaRoutes = new Hono<AppEnv>().get("/d/:name", async (c) => {
  const key = `d/${c.req.param("name")}`;
  const file = mediaKeySchema.safeParse(key).success
    ? await filesRepo(liveStore(c.env.DB)).find(key)
    : undefined;
  const object = file === undefined ? null : await c.env.MEDIA.get(key);
  if (file === undefined || object === null) {
    return problemResponse(c, 404);
  }
  return c.body(object.body, 200, {
    "Content-Type": mediaContentTypes[file.format],
    "Content-Length": String(object.size),
    "Content-Disposition": contentDisposition(file.name, file.format),
    "Cache-Control": IMMUTABLE,
    ETag: object.httpEtag,
  });
});
