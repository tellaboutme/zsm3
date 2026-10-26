import { PROBLEM_CONTENT_TYPE, type ProblemDetails } from "@zsm3/contracts/problem";
import {
  searchQuerySchema,
  searchResponseSchema,
  searchTextMaxLength,
  type SearchDocument,
  type SearchResponse,
} from "@zsm3/contracts/search";
import type { SearchTerms } from "@zsm3/worker/storage/search-repo.ts";

import { queryTerms, stem } from "./search-text.ts";
import { search, suggestion, type SearchEntry, type SearchIndex } from "./search.ts";
import { ON_DEMAND_CACHE } from "./security-headers.ts";
import { synonymGroups } from "../data/search-synonyms.ts";

export const SEARCH_RESULTS_LIMIT = 50;
export const FTS_RESULTS_LIMIT = 50;

export interface SearchBackend {
  readonly index: SearchIndex;
  readonly requestId: string;
  readonly find: (terms: SearchTerms) => Promise<readonly SearchDocument[]>;
}

function alternatives(term: string): readonly string[] {
  const base = stem(term);
  const related = synonymGroups
    .filter((group) => group.some((word) => word.startsWith(base) || base.startsWith(stem(word))))
    .flat();
  return [...new Set([term, ...related])];
}

export function matchGroups(query: string): SearchTerms {
  return queryTerms(query).map((term) => alternatives(term));
}

export function documentEntry(doc: SearchDocument): SearchEntry {
  return {
    type: doc.kind,
    title: doc.title,
    href: doc.href,
    text: doc.body.slice(0, searchTextMaxLength),
  };
}

export function mergeResults(
  scored: readonly SearchEntry[],
  indexed: readonly SearchEntry[],
): readonly SearchEntry[] {
  const seen = new Set<string>();
  return [...scored, ...indexed]
    .filter((entry) => {
      if (seen.has(entry.href)) {
        return false;
      }
      seen.add(entry.href);
      return true;
    })
    .slice(0, SEARCH_RESULTS_LIMIT);
}

export function searchResponse(
  index: SearchIndex,
  query: string,
  documents: readonly SearchDocument[],
): SearchResponse {
  const results = mergeResults(search(index, query), documents.map(documentEntry));
  const proposal = results.length === 0 ? suggestion(index, query) : undefined;
  return searchResponseSchema.parse({
    results: results.map(({ type, title, href, text }) => ({ type, title, href, text })),
    ...(proposal === undefined ? {} : { suggestion: proposal }),
  });
}

function invalidQuery(requestId: string): Response {
  const problem: ProblemDetails = {
    type: "about:blank",
    title: "Bad Request",
    status: 400,
    requestId,
  };
  return new Response(JSON.stringify(problem), {
    status: 400,
    headers: { "Content-Type": PROBLEM_CONTENT_TYPE },
  });
}

function jsonResponse(payload: SearchResponse): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": ON_DEMAND_CACHE,
    },
  });
}

export async function searchEndpoint(
  params: URLSearchParams,
  backend: SearchBackend,
): Promise<Response> {
  const query = searchQuerySchema.safeParse(params.get("q") ?? "");
  if (!query.success) {
    return invalidQuery(backend.requestId);
  }
  const documents = await backend.find(matchGroups(query.data));
  return jsonResponse(searchResponse(backend.index, query.data, documents));
}
