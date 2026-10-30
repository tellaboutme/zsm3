import { isRoutablePagePath } from "../../lib/navigation.ts";
import { latestNews } from "../../lib/news-listing.ts";
import { newsEntry, SEARCH_NEWS_LIMIT } from "../../lib/news-search.ts";
import { contentPageEntry } from "../../lib/search-sources.ts";
import { newsReader } from "../../server/news.ts";
import { pagesReader } from "../../server/pages.ts";
import { siteSearchEntries } from "../../server/search-entries.ts";

export const prerender = false;

export async function GET(): Promise<Response> {
  const [news, pages, site] = await Promise.all([
    latestNews(newsReader(), SEARCH_NEWS_LIMIT),
    pagesReader().published(),
    siteSearchEntries(),
  ]);
  const entries = [
    ...site,
    ...pages.filter((page) => isRoutablePagePath(page.path)).map(contentPageEntry),
    ...news.map(newsEntry),
  ];
  return new Response(JSON.stringify(entries), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
