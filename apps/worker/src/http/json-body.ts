import type { Context } from "hono";

import type { AppEnv } from "../app-env.ts";

const JSON_CONTENT_TYPE = "application/json";

export type JsonBody =
  | { readonly ok: true; readonly body: unknown }
  | { readonly ok: false; readonly status: 400 | 415 };

export async function readJson(c: Context<AppEnv>): Promise<JsonBody> {
  const contentType = c.req.header("Content-Type") ?? "";
  if (!contentType.startsWith(JSON_CONTENT_TYPE)) {
    return { ok: false, status: 415 };
  }
  try {
    return { ok: true, body: await c.req.json() };
  } catch {
    return { ok: false, status: 400 };
  }
}
