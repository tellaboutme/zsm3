import type { APIRoute } from "astro";

import { rssXml, SITE_ORIGIN } from "../../lib/seo.ts";
import { newsReader } from "../../server/news.ts";

const FEED_LIMIT = 50;

export const prerender = false;

export const GET: APIRoute = async () => {
  const items = await newsReader().published({}, { limit: FEED_LIMIT, offset: 0 });
  return new Response(rssXml(SITE_ORIGIN, items), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
