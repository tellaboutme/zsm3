import { isoDay, upcomingEvents } from "../lib/calendar.ts";

function initUpcomingEvents(): void {
  const list = document.querySelector<HTMLElement>("[data-upcoming]");
  const empty = document.querySelector<HTMLElement>("[data-no-events]");
  if (list === null || empty === null) {
    return;
  }
  const events = [...list.querySelectorAll<HTMLElement>("[data-event]")].map((item) => ({
    item,
    date: item.dataset["date"] ?? "",
    endDate: item.dataset["endDate"],
  }));
  const count = Number(list.dataset["upcoming"]);
  const visible = new Set(
    upcomingEvents(events, isoDay(new Date()), count).map(({ item }) => item),
  );
  for (const { item } of events) {
    item.hidden = !visible.has(item);
  }
  empty.hidden = visible.size > 0;
}

initUpcomingEvents();
