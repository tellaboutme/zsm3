import { PROBLEM_CONTENT_TYPE, type ProblemDetails } from "@zsm3/contracts/problem";
import type { Context } from "hono";

import type { AppEnv } from "../app-env.ts";

const titles = {
  404: "Not Found",
  413: "Content Too Large",
  500: "Internal Server Error",
} as const;

export type ProblemStatus = keyof typeof titles;

export function isProblemStatus(status: number): status is ProblemStatus {
  return Object.hasOwn(titles, status);
}

export function problemResponse(c: Context<AppEnv>, status: ProblemStatus): Response {
  const problem: ProblemDetails = {
    type: "about:blank",
    title: titles[status],
    status,
    requestId: c.var.requestId,
  };
  return c.body(JSON.stringify(problem), status, { "Content-Type": PROBLEM_CONTENT_TYPE });
}
