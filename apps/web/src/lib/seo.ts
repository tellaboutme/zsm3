import type { News, SchoolEvent } from "@zsm3/contracts/content";

import { newsHref } from "./news.ts";

export const SITE_ORIGIN = "https://www.zespolszkolmechanicznych.edu.pl";

export interface SitemapEntry {
  readonly path: string;
  readonly lastmod?: string;
}

export interface PublishedEntry {
  readonly path: string;
  readonly lastmod: string;
}

export function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).href;
}

export function canonicalUrl(url: URL): string {
  const path = url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/u, "");
  return absoluteUrl(SITE_ORIGIN, path.toLowerCase());
}

export function shouldNoindex(url: URL): boolean {
  return (
    url.search !== "" ||
    url.pathname === "/szukaj" ||
    /^\/aktualnosci\/(?:strona\/\d+|kategoria\/|\d{4}(?:\/strona\/\d+)?$)/u.test(url.pathname)
  );
}

export function sitemapEntries(
  staticPaths: readonly string[],
  published: readonly PublishedEntry[],
): readonly SitemapEntry[] {
  const entries = new Map<string, SitemapEntry>();
  for (const path of staticPaths) {
    if (!shouldNoindex(new URL(path, SITE_ORIGIN))) {
      entries.set(path, { path });
    }
  }
  for (const entry of published) {
    entries.set(entry.path, entry);
  }
  return [...entries.values()];
}

const XML_ENTITIES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function xml(value: string): string {
  return Array.from(value, (character) => XML_ENTITIES[character] ?? character).join("");
}

function sitemapUrl(origin: string, { path, lastmod }: SitemapEntry): string {
  const modified = lastmod === undefined ? "" : `<lastmod>${xml(lastmod.slice(0, 10))}</lastmod>`;
  return `<url><loc>${xml(absoluteUrl(origin, path))}</loc>${modified}</url>`;
}

export function sitemapXml(origin: string, entries: readonly SitemapEntry[]): string {
  const urls = entries.map((entry) => sitemapUrl(origin, entry));
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
}

function rssItem(origin: string, item: News): string {
  const url = xml(absoluteUrl(origin, newsHref(item)));
  return `<item><title>${xml(item.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${xml(item.lead)}</description><pubDate>${new Date(`${item.date}T00:00:00Z`).toUTCString()}</pubDate></item>`;
}

export function rssXml(origin: string, news: readonly News[]): string {
  const items = news.map((item) => rssItem(origin, item));
  const link = xml(absoluteUrl(origin, "/aktualnosci"));
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Aktualności — ZSM3</title><link>${link}</link><description>Aktualności Zespołu Szkół Mechanicznych nr 3 w Krakowie.</description><language>pl</language>${items.join("")}</channel></rss>`;
}

export function jsonLd(value: object): string {
  return JSON.stringify(value)
    .replace(/</gu, "\\u003c")
    .replace(/>/gu, "\\u003e")
    .replace(/&/gu, "\\u0026");
}

export function schoolYearSchemas(events: readonly SchoolEvent[], path: string): readonly object[] {
  return events
    .filter((event) => event.kind === "rok-szkolny")
    .map((event) => ({
      "@context": "https://schema.org",
      "@type": "Event",
      name: event.title,
      startDate: event.date,
      ...(event.note === undefined ? {} : { description: event.note }),
      url: absoluteUrl(SITE_ORIGIN, path),
    }));
}
