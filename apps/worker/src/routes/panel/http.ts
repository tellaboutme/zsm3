import type { Context } from "hono";
import type { ZodType } from "zod";

import type { AppEnv } from "../../app-env.ts";

export function uniqueQuery(c: Context<AppEnv>): Record<string, string> | undefined {
  const params = new URL(c.req.url).searchParams;
  return [...params.keys()].some((key) => params.getAll(key).length !== 1)
    ? undefined
    : Object.fromEntries(params);
}

export async function parseJsonBody<T>(
  c: Context<AppEnv>,
  schema: ZodType<T>,
): Promise<T | undefined> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return undefined;
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : undefined;
}
