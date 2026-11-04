import { Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "./app-env.ts";
import { isProblemStatus, problemResponse } from "./http/problem.ts";
import { assignRequestId } from "./http/request-id.ts";
import { apiSecurityHeaders, noStore } from "./http/security-headers.ts";
import { logEvent } from "./logging/log.ts";
import { galleryRoutes } from "./routes/gallery.ts";
import { healthRoutes } from "./routes/health.ts";
import { mediaRoutes } from "./routes/media.ts";
import { MAX_UPLOAD_BODY_BYTES, PANEL_UPLOAD_PREFIX } from "./routes/panel/files.ts";
import { panelApp, type PanelAppOptions } from "./routes/panel/index.ts";
import { isPhotoUploadPath, MAX_PHOTO_BODY_BYTES } from "./routes/panel/photos.ts";
import { shortLinkRoutes } from "./routes/short-links.ts";

export const MAX_BODY_BYTES = 16 * 1024;

function maxBodyBytes(path: string): number {
  if (path.startsWith(PANEL_UPLOAD_PREFIX)) {
    return MAX_UPLOAD_BODY_BYTES;
  }
  return isPhotoUploadPath(path) ? MAX_PHOTO_BODY_BYTES : MAX_BODY_BYTES;
}

const bodyLimitForPath: MiddlewareHandler<AppEnv> = async (c, next) => {
  await bodyLimit({ maxSize: maxBodyBytes(c.req.path) })(c, next);
};

export function createApp(panel: PanelAppOptions = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use(assignRequestId, apiSecurityHeaders, noStore, bodyLimitForPath);
  app.route("/api", healthRoutes);
  app.route("/api/short-links", shortLinkRoutes);
  app.route("/api/gallery", galleryRoutes);
  app.route("/media", mediaRoutes);
  app.route("/api/panel", panelApp(panel));
  app.notFound((c) => problemResponse(c, 404));
  app.onError((error, c) => {
    if (error instanceof HTTPException && isProblemStatus(error.status)) {
      return problemResponse(c, error.status);
    }
    logEvent({ event: "unhandled_error", requestId: c.var.requestId, errorName: error.name });
    return problemResponse(c, 500);
  });
  return app;
}
