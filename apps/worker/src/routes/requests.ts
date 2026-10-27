import { Hono, type Context } from "hono";

import type { AppEnv } from "../app-env.ts";
import { requestsConfig } from "../env.ts";
import { problemResponse } from "../http/problem.ts";
import { requestStatus } from "../requests/request-status.ts";
import { submitRequest, type SubmitRefusalReason } from "../requests/submit.ts";
import { withdrawRequest } from "../requests/withdraw.ts";
import { piiCrypto } from "../security/pii-crypto.ts";
import { turnstileVerifier } from "../security/turnstile.ts";
import { liveStore } from "../storage/database.ts";
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MINUTES,
  rateLimitKey,
  rateLimitsRepo,
  type RateLimitPurpose,
} from "../storage/rate-limits-repo.ts";
import { requestsRepo } from "../storage/requests-repo.ts";

const JSON_CONTENT_TYPE = "application/json";

type JsonBody =
  | { readonly ok: true; readonly body: unknown }
  | { readonly ok: false; readonly status: 400 | 415 };

type RefusalStatus = 400 | 403 | 409 | 429;

function clientIp(c: Context<AppEnv>): string {
  return c.req.header("CF-Connecting-IP") ?? "";
}

function originOf(c: Context<AppEnv>): string {
  return new URL(c.req.url).origin;
}

function isSameOrigin(c: Context<AppEnv>): boolean {
  const origin = c.req.header("Origin");
  if (origin === undefined) {
    return false;
  }
  try {
    return new URL(origin).origin === originOf(c);
  } catch {
    return false;
  }
}

async function readJson(c: Context<AppEnv>): Promise<JsonBody> {
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

function refusalStatus(reason: SubmitRefusalReason): RefusalStatus {
  switch (reason) {
    case "rate_limit":
      return 429;
    case "turnstile":
      return 403;
    case "open_limit":
      return 409;
    case "trap":
      return 400;
    case "invalid":
      return 400;
  }
}

function submitDeps(c: Context<AppEnv>) {
  const config = requestsConfig(c.env);
  const store = liveStore(c.env.DB);
  return {
    requests: requestsRepo(store),
    rateLimits: rateLimitsRepo(store),
    crypto: piiCrypto(config.piiKeys, config.activePiiKeyId, store.random),
    turnstile: turnstileVerifier(config.turnstileSecretKey),
    config,
    random: store.random,
  };
}

function tokenDeps(c: Context<AppEnv>) {
  const store = liveStore(c.env.DB);
  return { requests: requestsRepo(store), store };
}

function refusedResponse(c: Context<AppEnv>, reason: SubmitRefusalReason): Response {
  return problemResponse(c, refusalStatus(reason));
}

async function tokenRateLimited(c: Context<AppEnv>, purpose: RateLimitPurpose): Promise<boolean> {
  const now = new Date();
  const key = await rateLimitKey(requestsConfig(c.env).rateLimitSalt, clientIp(c), purpose);
  const cutoff = new Date(now.getTime() - RATE_LIMIT_WINDOW_MINUTES * 60_000);
  const state = await rateLimitsRepo(liveStore(c.env.DB)).consume(
    key,
    now.toISOString(),
    cutoff.toISOString(),
  );
  return state.count > RATE_LIMIT_MAX;
}

export const requestsRoutes = new Hono<AppEnv>()
  .post("/", async (c) => {
    if (!isSameOrigin(c)) {
      return problemResponse(c, 403);
    }
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return problemResponse(c, parsed.status);
    }
    const outcome = await submitRequest(submitDeps(c), {
      origin: originOf(c),
      clientIp: clientIp(c),
      body: parsed.body,
      now: new Date(),
    });
    if (outcome.kind === "refused") {
      return refusedResponse(c, outcome.reason);
    }
    return c.json({ statusUrl: outcome.statusUrl }, outcome.kind === "created" ? 201 : 200);
  })
  .post("/status", async (c) => {
    if (await tokenRateLimited(c, "status")) {
      return problemResponse(c, 429);
    }
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return problemResponse(c, parsed.status);
    }
    const outcome = await requestStatus(
      { requests: requestsRepo(liveStore(c.env.DB)) },
      parsed.body,
    );
    if (outcome.kind === "missing") {
      return problemResponse(c, 404);
    }
    return c.json(outcome.response, 200);
  })
  .post("/withdraw", async (c) => {
    if (!isSameOrigin(c)) {
      return problemResponse(c, 403);
    }
    if (await tokenRateLimited(c, "withdraw")) {
      return problemResponse(c, 429);
    }
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return problemResponse(c, parsed.status);
    }
    const outcome = await withdrawRequest(tokenDeps(c), parsed.body);
    if (outcome.kind === "missing") {
      return problemResponse(c, 404);
    }
    if (outcome.kind === "not_allowed") {
      return problemResponse(c, 409);
    }
    return c.json({ status: "withdrawn" }, 200);
  });
