import type { MiddlewareHandler } from "hono";

import type { AppEnv } from "../app-env.ts";
import { problemResponse } from "../http/problem.ts";

export interface RequireOriginOptions {
  readonly origin: string;
}

export const JSON_CONTENT_TYPE = "application/json";

const SAFE_METHODS = new Set(["GET", "HEAD"]);

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method);
}

export function requireOrigin(options: RequireOriginOptions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.req.header("Origin") !== options.origin) {
      return problemResponse(c, 403);
    }
    if (!isSafeMethod(c.req.method) && c.req.header("Content-Type") !== JSON_CONTENT_TYPE) {
      return problemResponse(c, 403);
    }
    return next();
  };
}
