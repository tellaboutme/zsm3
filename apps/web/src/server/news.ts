import { liveStore } from "@zsm3/worker/storage/database.ts";
import { newsRepo } from "@zsm3/worker/storage/news-repo.ts";
import { env } from "cloudflare:workers";

import type { NewsReader } from "../lib/news-listing.ts";

export function newsReader(): NewsReader {
  return newsRepo(liveStore(env.DB));
}

export function notFound(): Response {
  return new Response(null, { status: 404 });
}
