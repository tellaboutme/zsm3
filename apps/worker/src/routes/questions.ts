import { Hono, type Context } from "hono";

import type { AppEnv } from "../app-env.ts";
import { readJson } from "../http/json-body.ts";
import { isSameOrigin, originOf } from "../http/origin.ts";
import { problemResponse } from "../http/problem.ts";
import { questionsConfig, questionsEnabled } from "../questions/config.ts";
import { submitQuestion, type QuestionRefusal } from "../questions/submit.ts";
import { piiCrypto } from "../security/pii-crypto.ts";
import { QUESTION_TURNSTILE_ACTION, turnstileVerifier } from "../security/turnstile.ts";
import { liveStore } from "../storage/database.ts";
import { questionsRepo } from "../storage/questions-repo.ts";
import { rateLimitsRepo } from "../storage/rate-limits-repo.ts";

const REFUSAL_STATUS: Readonly<Record<QuestionRefusal, 400 | 403 | 429>> = {
  rate_limit: 429,
  turnstile: 403,
  invalid: 400,
};

function submitDeps(c: Context<AppEnv>) {
  const config = questionsConfig(c.env);
  const store = liveStore(c.env.DB);
  return {
    questions: questionsRepo(store),
    rateLimits: rateLimitsRepo(store),
    crypto: piiCrypto(config.piiKeys, config.activePiiKeyId, store.random),
    turnstile: turnstileVerifier(config.turnstileSecretKey, fetch, QUESTION_TURNSTILE_ACTION),
    config,
    random: store.random,
  };
}

export const questionsRoutes = new Hono<AppEnv>().post("/", async (c) => {
  if (!questionsEnabled(c.env)) {
    return problemResponse(c, 404);
  }
  if (!isSameOrigin(c)) {
    return problemResponse(c, 403);
  }
  const parsed = await readJson(c);
  if (!parsed.ok) {
    return problemResponse(c, parsed.status);
  }
  const outcome = await submitQuestion(submitDeps(c), {
    origin: originOf(c),
    clientIp: c.req.header("CF-Connecting-IP") ?? "",
    body: parsed.body,
    now: new Date(),
  });
  if (outcome.kind === "refused") {
    return problemResponse(c, REFUSAL_STATUS[outcome.reason]);
  }
  return c.json({ received: true }, 202);
});
