import type { StoredAnnouncement } from "@zsm3/contracts/announcements";

import { dayOffOn, type DayOff } from "./bells.ts";

export type Severity = "info" | "important" | "urgent";

export interface Announcement {
  readonly id: string;
  readonly severity: Severity;
  readonly text: string;
  readonly link?: { readonly label: string; readonly href: string };
}

export const DISMISSED_KEY = "zsm3.dismissed-banners";

export function readDismissed(serialized: string | null): ReadonlySet<string> {
  if (serialized === null) {
    return new Set();
  }
  try {
    const parsed: unknown = JSON.parse(serialized);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

export function withDismissed(dismissed: ReadonlySet<string>, id: string): string {
  return JSON.stringify([...new Set([...dismissed, id])]);
}

export function publicAnnouncement(item: StoredAnnouncement): Announcement {
  return {
    id: `${item.id}.${item.updatedAt}`,
    severity: item.severity,
    text: item.text,
    ...(item.link === undefined ? {} : { link: item.link }),
  };
}

export function dayOffAnnouncement(
  daysOff: readonly DayOff[],
  today: string,
  tomorrow: string,
): Announcement | undefined {
  const now = dayOffOn(daysOff, today);
  const next = now === undefined ? dayOffOn(daysOff, tomorrow) : undefined;
  const dayOff = now ?? next;
  if (dayOff === undefined) {
    return undefined;
  }
  const when = now === undefined ? "Jutro" : "Dziś";
  return {
    id: `wolne.${dayOff.from}.${when}`,
    severity: "info",
    text: `${when} nie ma zajęć: ${dayOff.title}.`,
    link: { label: "Terminarz", href: "/szkola/terminarz" },
  };
}
