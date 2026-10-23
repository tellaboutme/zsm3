import { defineMiddleware } from "astro:middleware";

import { isReadMethod, methodNotAllowed } from "./lib/page-methods.ts";
import {
  ON_DEMAND_CACHE,
  sitePageHeaders,
  withHeaders,
  type HeaderEntry,
} from "./lib/security-headers.ts";

let headers: Promise<readonly HeaderEntry[]> | undefined;

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) {
    return next();
  }
  const response = isReadMethod(context.request.method) ? await next() : methodNotAllowed();
  headers ??= sitePageHeaders();
  return withHeaders(response, [...(await headers), ["Cache-Control", ON_DEMAND_CACHE]]);
});
