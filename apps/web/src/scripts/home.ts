import { isoDay, upcomingEvents } from "../lib/calendar.ts";
import { isFieldFilter, matchesField, type FieldFilter } from "../lib/professions.ts";

function initFieldFilter(): void {
  const filter = document.querySelector<HTMLElement>("[data-field-filter]");
  const status = document.querySelector("[data-filter-status]");
  if (filter === null || status === null) {
    return;
  }
  const buttons = [...filter.querySelectorAll<HTMLButtonElement>("button[data-field]")];
  const tiles = [...document.querySelectorAll<HTMLElement>("[data-field]:not(button)")];
  const select = (selected: FieldFilter): void => {
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button.dataset["field"] === selected));
    }
    for (const tile of tiles) {
      tile.hidden = !matchesField(tile.dataset["field"], selected);
    }
    const shown = tiles.filter((tile) => matchesField(tile.dataset["field"], selected)).length;
    status.textContent = `Pokazano zawody: ${String(shown)} z ${String(tiles.length)}`;
  };
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const value = button.dataset["field"];
      if (isFieldFilter(value)) {
        select(value);
      }
    });
  }
  filter.hidden = false;
}

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

initFieldFilter();
initUpcomingEvents();
