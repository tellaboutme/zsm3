import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "./app-env.ts";
import { MissingSecretError } from "./env.ts";
import { isProblemStatus, problemResponse } from "./http/problem.ts";
import { assignRequestId } from "./http/request-id.ts";
import { apiSecurityHeaders, noStore } from "./http/security-headers.ts";
import { logEvent } from "./logging/log.ts";
import { questionsRoutes } from "./routes/questions.ts";

export const QUESTIONS_PREFIX = "/api/questions";
export const MAX_QUESTION_BODY_BYTES = 8 * 1024;

export function createQuestionsApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use(
    assignRequestId,
    apiSecurityHeaders,
    noStore,
    bodyLimit({ maxSize: MAX_QUESTION_BODY_BYTES }),
  );
  app.route(QUESTIONS_PREFIX, questionsRoutes);
  app.notFound((c) => problemResponse(c, 404));
  app.onError((error, c) => {
    if (error instanceof MissingSecretError) {
      return problemResponse(c, 503);
    }
    if (error instanceof HTTPException && isProblemStatus(error.status)) {
      return problemResponse(c, error.status);
    }
    logEvent({ event: "unhandled_error", requestId: c.var.requestId, errorName: error.name });
    return problemResponse(c, 500);
  });
  return app;
}
