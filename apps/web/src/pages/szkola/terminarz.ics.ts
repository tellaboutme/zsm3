import { eventKindLabels, isoDay, schoolYearName } from "../../lib/calendar.ts";
import { toIcs } from "../../lib/ics.ts";
import { schoolYearEvents } from "../../server/site-state.ts";

export const prerender = false;

export async function GET(): Promise<Response> {
  const day = isoDay(new Date());
  const entries = (await schoolYearEvents(day)).map((event) => ({
    date: event.date,
    endDate: event.endDate,
    title: event.title,
    note: event.note,
    category: eventKindLabels[event.kind],
  }));
  return new Response(toIcs(`ZSM3: terminarz roku szkolnego ${schoolYearName(day)}`, entries), {
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
  });
}
