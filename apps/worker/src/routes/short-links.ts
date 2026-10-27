import { Hono } from "hono";

import type { AppEnv } from "../app-env.ts";
import { isFormBody } from "../http/form-body.ts";
import { isOwnSubmission } from "../http/origin.ts";
import { problemResponse } from "../http/problem.ts";
import {
  passwordRedirect,
  submittedPassword,
  unlockLink,
  type UnlockOutcome,
} from "../short-links/resolve.ts";
import { liveStore } from "../storage/database.ts";
import { rateLimitsRepo } from "../storage/rate-limits-repo.ts";
import { shortLinksRepo } from "../storage/short-links-repo.ts";

const PASSWORD_FIELD = "haslo";

export const shortLinkRoutes = new Hono<AppEnv>().post("/:code", async (c) => {
  if (!isOwnSubmission(c)) {
    return problemResponse(c, 403);
  }
  if (!isFormBody(c.req.header("Content-Type"))) {
    return problemResponse(c, 415);
  }
  const code = c.req.param("code");
  const store = liveStore(c.env.DB);
  const submitted = await c.req.parseBody();
  const password = submittedPassword(submitted[PASSWORD_FIELD]);
  const deps = {
    links: shortLinksRepo(store),
    rateLimits: rateLimitsRepo(store),
    passwordKey: c.env.SHORT_LINK_KEY,
  };
  const outcome: UnlockOutcome =
    password === undefined
      ? { kind: "locked" }
      : await unlockLink(deps, code, password, new Date());
  return c.body(null, 303, {
    Location: passwordRedirect(outcome, `/s/${encodeURIComponent(code)}`),
  });
});
