import { handle } from "@astrojs/cloudflare/handler";
import { createApp } from "@zsm3/worker/app";

const api = createApp();

export default {
  fetch: async (request, env, context) =>
    new URL(request.url).pathname.startsWith("/api/")
      ? api.fetch(request, env, context)
      : handle(request, env, context),
} satisfies ExportedHandler<Env>;
