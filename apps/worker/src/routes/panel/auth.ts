import type { MiddlewareHandler } from "hono";

import { requirePanelDeps, type PanelSession } from "./deps.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import { logEvent } from "../../logging/log.ts";
import type { AccessClaims } from "../../security/access-claims.ts";
import { AccessConfigError } from "../../security/access-jwt.ts";

const BEARER_PREFIX = "Bearer ";

export function bearerToken(headers: Headers): string | undefined {
  const assertion = headers.get("Cf-Access-Jwt-Assertion");
  if (assertion !== null && assertion.trim().length > 0) {
    return assertion.trim();
  }
  const bearer = headers.get("Authorization");
  if (bearer?.startsWith(BEARER_PREFIX) === true) {
    return bearer.slice(BEARER_PREFIX.length).trim();
  }
  return undefined;
}

export async function verifyClaims(
  headers: Headers,
  verifier: (token: string) => Promise<AccessClaims>,
): Promise<AccessClaims | undefined> {
  const token = bearerToken(headers);
  return token === undefined ? undefined : verifier(token);
}

export const authenticatePanel: MiddlewareHandler<AppEnv> = async (c, next) => {
  const deps = requirePanelDeps(c);
  let claims: AccessClaims | undefined;
  try {
    claims = await verifyClaims(c.req.raw.headers, deps.verifier);
  } catch (error) {
    if (error instanceof AccessConfigError) {
      logEvent({ event: "access_config_missing", requestId: c.var.requestId });
      return problemResponse(c, 503);
    }
    return problemResponse(c, 401);
  }
  if (claims === undefined) {
    return problemResponse(c, 401);
  }
  const staff = await deps.repos.staff.get(claims.email);
  if (staff === undefined) {
    return problemResponse(c, 403);
  }
  if (!staff.active) {
    return problemResponse(c, 403);
  }
  const session: PanelSession = { email: claims.email, role: staff.role };
  c.set("panel", session);
  return next();
};
