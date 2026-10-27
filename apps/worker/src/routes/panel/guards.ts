import type { PanelRouteName } from "@zsm3/contracts/panel";
import type { MiddlewareHandler } from "hono";

import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { routeAllowed } from "./matrix.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import { isSafeMethod, requireOrigin } from "../../security/origin.ts";

export const panelGuard =
  (route: PanelRouteName): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const session = requirePanelSession(c);
    if (!routeAllowed(route, session.role)) {
      return problemResponse(c, 403);
    }
    return next();
  };

export const panelOrigin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (isSafeMethod(c.req.method)) {
    return next();
  }
  const deps = requirePanelDeps(c);
  if (c.req.header("Origin") !== deps.origin) {
    return problemResponse(c, 403);
  }
  return next();
};

export const panelJsonOrigin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (isSafeMethod(c.req.method)) {
    return next();
  }
  const deps = requirePanelDeps(c);
  return requireOrigin({ origin: deps.origin })(c, next);
};
