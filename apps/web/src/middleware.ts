import { defineMiddleware } from "astro:middleware";

import {
  ON_DEMAND_CACHE,
  sitePageHeaders,
  withHeaders,
  type HeaderEntry,
} from "./lib/security-headers.ts";

let headers: Promise<readonly HeaderEntry[]> | undefined;

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (context.isPrerendered) {
    return response;
  }
  headers ??= sitePageHeaders();
  return withHeaders(response, [...(await headers), ["Cache-Control", ON_DEMAND_CACHE]]);
});
