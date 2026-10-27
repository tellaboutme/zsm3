import { PROBLEM_CONTENT_TYPE, type ProblemDetails } from "@zsm3/contracts/problem";
import type { Context } from "hono";

import type { AppEnv } from "../app-env.ts";

const titles = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Content Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
} as const;

export type ProblemStatus = keyof typeof titles;

export function isProblemStatus(status: number): status is ProblemStatus {
  return Object.hasOwn(titles, status);
}

export function problemResponse(
  c: Context<AppEnv>,
  status: ProblemStatus,
  title: string = titles[status],
): Response {
  const problem: ProblemDetails = {
    type: "about:blank",
    title,
    status,
    requestId: c.var.requestId,
  };
  return c.body(JSON.stringify(problem), status, { "Content-Type": PROBLEM_CONTENT_TYPE });
}
