import { contacts, documentGroups, meetings, programmeData, staffDirectory } from "./datasets.ts";
import { schoolYearEvents } from "./site-state.ts";
import { baseSearchEntries } from "../data/search-index.ts";
import { isoDay } from "../lib/calendar.ts";
import { datasetEntries, eventEntry } from "../lib/search-sources.ts";
import type { SearchEntry } from "../lib/search.ts";

export async function siteSearchEntries(): Promise<readonly SearchEntry[]> {
  const [events, staff, classes, cards, documents, kierunki] = await Promise.all([
    schoolYearEvents(isoDay(new Date())),
    staffDirectory(),
    meetings(),
    contacts(),
    documentGroups(),
    programmeData(),
  ]);
  return [
    ...baseSearchEntries(kierunki),
    ...events.map(eventEntry),
    ...datasetEntries({ staff, meetings: classes, contacts: cards, documents }),
  ];
}
