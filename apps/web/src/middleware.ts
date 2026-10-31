import { defineMiddleware } from "astro:middleware";

import { fallbackBells } from "./data/bell-schedule.ts";
import { dayOffAnnouncement } from "./lib/announcement.ts";
import { daysOffFrom } from "./lib/bells.ts";
import { isoDay } from "./lib/calendar.ts";
import { isReadMethod, isSitePage, methodNotAllowed } from "./lib/page-methods.ts";
import {
  ON_DEMAND_CACHE,
  PANEL_CACHE,
  sitePageHeaders,
  withHeaders,
  type HeaderEntry,
} from "./lib/security-headers.ts";

const DAY_MS = 86_400_000;

let headers: Promise<readonly HeaderEntry[]> | undefined;

function cacheEntry(path: string): HeaderEntry {
  const panel = path === "/panel" || path.startsWith("/panel/");
  return ["Cache-Control", panel ? PANEL_CACHE : ON_DEMAND_CACHE];
}

type SiteState = Pick<App.Locals, "announcement" | "bells" | "events" | "navigation">;

async function siteState(): Promise<SiteState> {
  const { activeAnnouncement, publishedBells, publishedNavigation, schoolYearEvents } =
    await import("./server/site-state.ts");
  const day = isoDay(new Date());
  const [announcement, bells, events, navigation] = await Promise.all([
    activeAnnouncement(day),
    publishedBells(day),
    schoolYearEvents(day),
    publishedNavigation(),
  ]);
  const daysOff = daysOffFrom(events, day);
  const tomorrow = isoDay(new Date(Date.now() + DAY_MS));
  const shown = announcement ?? dayOffAnnouncement(daysOff, day, tomorrow);
  return {
    events,
    bells: { ...(bells ?? fallbackBells), daysOff },
    navigation,
    ...(shown === undefined ? {} : { announcement: shown }),
  };
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) {
    return next();
  }
  const read = isReadMethod(context.request.method);
  if (read && isSitePage(context.url.pathname)) {
    Object.assign(context.locals, await siteState());
  }
  const response = read ? await next() : methodNotAllowed();
  headers ??= sitePageHeaders();
  return withHeaders(response, [...(await headers), cacheEntry(context.url.pathname)]);
});
