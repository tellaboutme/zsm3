import type { APIRoute } from "astro";

import { sitemapXml, SITE_ORIGIN } from "../lib/seo.ts";
import { publishedSitemap } from "../server/sitemap.ts";

export const prerender = false;

export const GET: APIRoute = async () =>
  new Response(sitemapXml(SITE_ORIGIN, await publishedSitemap()), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
