import { handle } from "@astrojs/cloudflare/handler";
import { createApp } from "@zsm3/worker/app";
import { runScheduledMaintenance } from "@zsm3/worker/jobs/retention";
import { createRequestsApp } from "@zsm3/worker/requests-app";
import { liveStore } from "@zsm3/worker/storage/database.ts";
import { redirectsRepo } from "@zsm3/worker/storage/redirects-repo.ts";

import { routeLegacyRequest } from "./legacy-route.ts";
import { withQueryNoindex } from "./seo-response.ts";

const api = createApp();
const requestsApi = createRequestsApp();

const REQUESTS_PREFIX = "/api/requests";
const API_PREFIXES = ["/api/", "/media/"];

function isRequestsPath(pathname: string): boolean {
  return pathname === REQUESTS_PREFIX || pathname.startsWith(`${REQUESTS_PREFIX}/`);
}

export default {
  fetch: async (request, env, context) => {
    const { pathname } = new URL(request.url);
    if (isRequestsPath(pathname)) {
      return requestsApi.fetch(request, env, context);
    }
    if (API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return api.fetch(request, env, context);
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
    context.waitUntil(
      runScheduledMaintenance(env, liveStore(env.DB), new Date(event.scheduledTime)),
    );
  },
} satisfies ExportedHandler<Env>;
