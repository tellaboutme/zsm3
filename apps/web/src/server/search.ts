import { liveStore } from "@zsm3/worker/storage/database.ts";
import { searchRepo } from "@zsm3/worker/storage/search-repo.ts";
import { env } from "cloudflare:workers";

import { staticSearchEntries } from "../data/search-index.ts";
import { FTS_RESULTS_LIMIT, searchEndpoint, type SearchBackend } from "../lib/search-server.ts";
import { prepare, type SearchIndex } from "../lib/search.ts";

let index: SearchIndex | undefined;

function staticIndex(): SearchIndex {
  index ??= prepare(staticSearchEntries);
  return index;
}

export async function searchPage(params: URLSearchParams): Promise<Response> {
  const backend: SearchBackend = {
    index: staticIndex(),
    requestId: crypto.randomUUID(),
    find: async (terms) => searchRepo(liveStore(env.DB)).search(terms, FTS_RESULTS_LIMIT),
  };
  return searchEndpoint(params, backend);
}
