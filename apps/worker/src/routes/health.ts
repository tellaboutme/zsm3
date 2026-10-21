import type { HealthResponse } from "@zsm3/contracts/health";
import { Hono } from "hono";

import type { AppEnv } from "../app-env.ts";

const healthy: HealthResponse = { status: "ok" };

export const healthRoutes = new Hono<AppEnv>().get("/health", (c) => c.json(healthy));
