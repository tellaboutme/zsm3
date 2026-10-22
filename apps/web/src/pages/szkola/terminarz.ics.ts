import { schoolYearEvents } from "../../data/calendar/index.ts";
import { eventKindLabels } from "../../lib/calendar.ts";
import { toIcs } from "../../lib/ics.ts";

export function GET(): Response {
  const entries = schoolYearEvents.map((event) => ({
    date: event.date,
    endDate: event.endDate,
    title: event.title,
    note: event.note,
    category: eventKindLabels[event.kind],
  }));
  return new Response(toIcs("ZSM3: terminarz roku szkolnego 2026/2027", entries), {
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
  });
}
