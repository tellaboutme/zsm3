import { navigationSchema, type Navigation } from "@zsm3/contracts/navigation";
import { schoolYearRange } from "@zsm3/contracts/panel";
import { announcementsRepo } from "@zsm3/worker/storage/announcements-repo.ts";
import { bellsRepo } from "@zsm3/worker/storage/bells-repo.ts";
import { liveStore } from "@zsm3/worker/storage/database.ts";
import { datasetsRepo } from "@zsm3/worker/storage/datasets-repo.ts";
import { eventsRepo } from "@zsm3/worker/storage/events-repo.ts";
import { env } from "cloudflare:workers";

import { publicAnnouncement, type Announcement } from "../lib/announcement.ts";
import { bellData, type BellData } from "../lib/bells.ts";
import { schoolYearStart, type SchoolEvent } from "../lib/calendar.ts";

export async function activeAnnouncement(day: string): Promise<Announcement | undefined> {
  const item = await announcementsRepo(liveStore(env.DB)).active(day);
  return item === undefined ? undefined : publicAnnouncement(item);
}

export async function publishedBells(day: string): Promise<BellData | undefined> {
  const schedule = await bellsRepo(liveStore(env.DB)).get();
  return schedule === undefined ? undefined : bellData(schedule, day);
}

export async function schoolYearEvents(day: string): Promise<readonly SchoolEvent[]> {
  const [from, to] = schoolYearRange(schoolYearStart(day));
  return eventsRepo(liveStore(env.DB)).between(from, to);
}

export async function publishedNavigation(): Promise<Navigation | undefined> {
  const stored = await datasetsRepo(liveStore(env.DB)).get("nawigacja");
  return stored === undefined ? undefined : navigationSchema.parse(stored.data);
}
