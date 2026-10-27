import { panelMeSchema } from "@zsm3/contracts/panel";
import { Hono } from "hono";

import { requirePanelSession } from "./deps.ts";
import { panelGuard } from "./guards.ts";
import type { AppEnv } from "../../app-env.ts";

export function sessionRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>().get("/me", panelGuard("me"), (c) => {
    const session = requirePanelSession(c);
    return c.json(panelMeSchema.parse({ email: session.email, role: session.role }));
  });
}
