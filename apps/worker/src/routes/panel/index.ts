import { Hono, type Context, type MiddlewareHandler } from "hono";

import { announcementsRoutes } from "./announcements.ts";
import { auditRoutes } from "./audit-log.ts";
import { authenticatePanel } from "./auth.ts";
import { bellsRoutes } from "./bells.ts";
import { datasetsRoutes } from "./datasets.ts";
import type { BackgroundTask, PanelDeps } from "./deps.ts";
import { indexNowNotify, panelOrigin } from "./deps.ts";
import { eventsRoutes } from "./events.ts";
import { filesRoutes } from "./files.ts";
import { newsRoutes } from "./news.ts";
import { pagesRoutes } from "./pages.ts";
import { questionsRoutes } from "./questions.ts";
import { redirectsRoutes } from "./redirects.ts";
import { requestsRoutes } from "./requests.ts";
import { revisionsRoutes } from "./revisions.ts";
import { sessionRoutes } from "./session.ts";
import { shortLinksRoutes } from "./short-links.ts";
import { staffRoutes } from "./staff.ts";
import type { AppBindings, AppEnv } from "../../app-env.ts";
import { ACTIVE_PII_KEY_ID, piiKeys } from "../../env.ts";
import {
  AccessConfigError,
  accessIssuer,
  createAccessVerifier,
  remoteAccessJwks,
} from "../../security/access-jwt.ts";
import type { AccessVerifier } from "../../security/access-jwt.ts";
import { piiCrypto, type PiiCrypto } from "../../security/pii-crypto.ts";
import type { IndexNowEndpoint } from "../../services/indexnow.ts";
import { announcementsRepo } from "../../storage/announcements-repo.ts";
import { auditRepo } from "../../storage/audit-repo.ts";
import { bellsRepo } from "../../storage/bells-repo.ts";
import { liveStore, systemClock } from "../../storage/database.ts";
import { datasetsRepo } from "../../storage/datasets-repo.ts";
import { eventsRepo } from "../../storage/events-repo.ts";
import { filesRepo } from "../../storage/files-repo.ts";
import { newsRepo } from "../../storage/news-repo.ts";
import { pagesRepo } from "../../storage/pages-repo.ts";
import { questionsRepo } from "../../storage/questions-repo.ts";
import { redirectsRepo } from "../../storage/redirects-repo.ts";
import { requestsRepo } from "../../storage/requests-repo.ts";
import { revisionsRepo } from "../../storage/revisions-repo.ts";
import { shortLinksRepo } from "../../storage/short-links-repo.ts";
import { staffRepo } from "../../storage/staff-repo.ts";

export interface PanelAppOptions {
  readonly verifier?: AccessVerifier;
  readonly origin?: string;
  readonly piiCrypto?: PiiCrypto;
  readonly indexnow?: IndexNowEndpoint;
}

function envAccessVerifier(env: AppBindings): AccessVerifier {
  const teamDomain = env.ACCESS_TEAM_DOMAIN.trim();
  const audience = env.ACCESS_AUDIENCE.trim();
  if (teamDomain.length === 0 || audience.length === 0) {
    return () => {
      throw new AccessConfigError();
    };
  }
  const jwks = remoteAccessJwks(teamDomain);
  return createAccessVerifier({
    jwks,
    audience,
    issuer: accessIssuer(teamDomain),
    now: systemClock,
  });
}

function backgroundTask(c: Context<AppEnv>): BackgroundTask {
  try {
    const execution = c.executionCtx;
    return async (task) => {
      execution.waitUntil(task);
      return Promise.resolve();
    };
  } catch {
    return async (task) => {
      await task;
    };
  }
}

function injectPanelDeps(options: PanelAppOptions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const store = liveStore(c.env.DB);
    const deps: PanelDeps = {
      db: store.db,
      repos: {
        staff: staffRepo(store),
        audit: auditRepo(store),
        revisions: revisionsRepo(store),
        news: newsRepo(store),
        pages: pagesRepo(store),
        events: eventsRepo(store),
        files: filesRepo(store),
        redirects: redirectsRepo(store),
        shortLinks: shortLinksRepo(store),
        announcements: announcementsRepo(store),
        bells: bellsRepo(store),
        datasets: datasetsRepo(store),
        requests: requestsRepo(store),
        questions: questionsRepo(store),
      },
      mediaBucket: c.env.MEDIA,
      origin: options.origin ?? panelOrigin(c.env),
      verifier: options.verifier ?? (async (token) => envAccessVerifier(c.env)(token)),
      piiCrypto: options.piiCrypto ?? piiCrypto(piiKeys(c.env), ACTIVE_PII_KEY_ID, store.random),
      notifyIndexNow: indexNowNotify(c.env, options.indexnow),
      defer: backgroundTask(c),
    };
    c.set("panelDeps", deps);
    await next();
  };
}

export function panelApp(options: PanelAppOptions = {}): Hono<AppEnv> {
  const panel = new Hono<AppEnv>();
  panel.use(injectPanelDeps(options));
  panel.use(authenticatePanel);
  panel.route("/", sessionRoutes());
  panel.route("/", newsRoutes());
  panel.route("/", pagesRoutes());
  panel.route("/", eventsRoutes());
  panel.route("/", filesRoutes());
  panel.route("/", redirectsRoutes());
  panel.route("/", shortLinksRoutes());
  panel.route("/", staffRoutes());
  panel.route("/", announcementsRoutes());
  panel.route("/", bellsRoutes());
  panel.route("/", revisionsRoutes());
  panel.route("/", auditRoutes());
  panel.route("/", datasetsRoutes());
  panel.route("/", requestsRoutes());
  panel.route("/", questionsRoutes());
  return panel;
}
