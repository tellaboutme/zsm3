import type { Context } from "hono";

import type { AppEnv } from "../app-env.ts";

export function originOf(c: Context<AppEnv>): string {
  return new URL(c.req.url).origin;
}

export function isSameOrigin(c: Context<AppEnv>): boolean {
  const origin = c.req.header("Origin");
  if (origin === undefined) {
    return false;
  }
  try {
    return new URL(origin).origin === originOf(c);
  } catch {
    return false;
  }
}
