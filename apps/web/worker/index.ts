import { handle } from "@astrojs/cloudflare/handler";
import { createApp } from "@zsm3/worker/app";
import { liveStore } from "@zsm3/worker/storage/database.ts";
import { redirectsRepo } from "@zsm3/worker/storage/redirects-repo.ts";

import { routeLegacyRequest } from "./legacy-route.ts";

const api = createApp();

const API_PREFIXES = ["/api/", "/media/"];

export default {
  fetch: async (request, env, context) => {
    const { pathname } = new URL(request.url);
    if (API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return api.fetch(request, env, context);
    }
    const response = await handle(request, env, context);
    const repo = redirectsRepo(liveStore(env.DB));
    return routeLegacyRequest(
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
  },
} satisfies ExportedHandler<Env>;
