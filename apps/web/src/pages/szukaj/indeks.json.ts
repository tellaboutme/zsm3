import { staticSearchEntries } from "../../data/search-index.ts";
import { latestNews } from "../../lib/news-listing.ts";
import { newsEntry, SEARCH_NEWS_LIMIT } from "../../lib/news-search.ts";
import { newsReader } from "../../server/news.ts";

export const prerender = false;

export async function GET(): Promise<Response> {
  const news = await latestNews(newsReader(), SEARCH_NEWS_LIMIT);
  return new Response(JSON.stringify([...staticSearchEntries, ...news.map(newsEntry)]), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
