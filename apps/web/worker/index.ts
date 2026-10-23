import { handle } from "@astrojs/cloudflare/handler";
import { createApp } from "@zsm3/worker/app";

const api = createApp();

const API_PREFIXES = ["/api/", "/media/"];

export default {
  fetch: async (request, env, context) => {
    const { pathname } = new URL(request.url);
    return API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
      ? api.fetch(request, env, context)
      : handle(request, env, context);
  },
} satisfies ExportedHandler<Env>;
