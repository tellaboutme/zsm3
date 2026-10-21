import type { MiddlewareHandler } from "hono";

import type { AppEnv } from "../app-env.ts";

export const REQUEST_ID_HEADER = "X-Request-Id";

export const assignRequestId: MiddlewareHandler<AppEnv> = async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.header(REQUEST_ID_HEADER, requestId);
  await next();
};
