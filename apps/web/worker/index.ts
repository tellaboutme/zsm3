import { handle } from "@astrojs/cloudflare/handler";
import { createApp } from "@zsm3/worker/app";
import { runPhotoCleanup } from "@zsm3/worker/jobs/photo-cleanup";
import { runScheduledMaintenance } from "@zsm3/worker/jobs/retention";
import { createQuestionsApp, QUESTIONS_PREFIX } from "@zsm3/worker/questions-app";
import { createRequestsApp } from "@zsm3/worker/requests-app";
import { liveStore } from "@zsm3/worker/storage/database.ts";
import { redirectsRepo } from "@zsm3/worker/storage/redirects-repo.ts";

import { routeLegacyRequest } from "./legacy-route.ts";
import { requestAlias } from "./request-alias.ts";
import { withQueryNoindex } from "./seo-response.ts";

const api = createApp();
const requestsApi = createRequestsApp();
const questionsApi = createQuestionsApp();

const REQUESTS_PREFIX = "/api/requests";
const API_PREFIXES = ["/api/", "/media/"];

function under(prefix: string, pathname: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export default {
  fetch: async (request, env, context) => {
    const { pathname } = new URL(request.url);
    if (under(REQUESTS_PREFIX, pathname)) {
      return requestsApi.fetch(request, env, context);
    }
    if (under(QUESTIONS_PREFIX, pathname)) {
      return questionsApi.fetch(request, env, context);
    }
    if (API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return api.fetch(request, env, context);
    }
    const alias = await requestAlias(request);
    if (alias !== undefined) {
      return alias;
    }
    const response = await handle(request, env, context);
    const repo = redirectsRepo(liveStore(env.DB));
    const page = await routeLegacyRequest(
      request,
      response,
      async (path) => {
        const target = await repo.target(path);
        return target;
      },
      async (path) => {
        const target = new Request(new URL(path, request.url), { method: "GET" });
        const result = await handle(target, env, context);
        return result.ok;
      },
    );
    return withQueryNoindex(request, page);
  },
  scheduled: (event, env, context) => {
    const store = liveStore(env.DB);
    const now = new Date(event.scheduledTime);
    context.waitUntil(runScheduledMaintenance(env, store, now));
    context.waitUntil(runPhotoCleanup(env.MEDIA, store, now));
  },
} satisfies ExportedHandler<Env>;
