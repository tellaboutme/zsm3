import { liveStore } from "@zsm3/worker/storage/database.ts";
import { sitemapRepo } from "@zsm3/worker/storage/sitemap-repo.ts";
import { env } from "cloudflare:workers";

import { programmeData } from "./datasets.ts";
import { buildSiteMap } from "../data/site-map.ts";
import { isRoutablePagePath } from "../lib/navigation.ts";
import { sitemapEntries, type SitemapEntry } from "../lib/seo.ts";
import { flattenMap } from "../lib/site-map.ts";

export async function publishedSitemap(): Promise<readonly SitemapEntry[]> {
  const staticPaths = flattenMap(buildSiteMap([], await programmeData())).map((node) => node.href);
  const published = await sitemapRepo(liveStore(env.DB)).published();
  return sitemapEntries(
    staticPaths,
    published.filter((entry) => isRoutablePagePath(entry.path)),
  );
}
