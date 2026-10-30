import { liveStore } from "@zsm3/worker/storage/database.ts";
import { searchRepo } from "@zsm3/worker/storage/search-repo.ts";
import { env } from "cloudflare:workers";

import { siteSearchEntries } from "./search-entries.ts";
import { isRoutablePagePath } from "../lib/navigation.ts";
import { FTS_RESULTS_LIMIT, searchEndpoint, type SearchBackend } from "../lib/search-server.ts";
import { prepare } from "../lib/search.ts";

export async function searchPage(params: URLSearchParams): Promise<Response> {
  const backend: SearchBackend = {
    index: prepare(await siteSearchEntries()),
    requestId: crypto.randomUUID(),
    find: async (terms) =>
      (await searchRepo(liveStore(env.DB)).search(terms, FTS_RESULTS_LIMIT)).filter((document) =>
        isRoutablePagePath(document.href),
      ),
  };
  return searchEndpoint(params, backend);
}
