import { fallbackBells } from "../data/bell-schedule.ts";
import { readBellData, todaySchedule } from "../lib/bells.ts";
import { isoDay } from "../lib/calendar.ts";

function initBellsPage(): void {
  const label = document.querySelector("[data-today-label]");
  const empty = document.querySelector<HTMLElement>("[data-no-variants]");
  if (label === null || empty === null) {
    return;
  }
  const today = isoDay(new Date());
  const bells = readBellData(document.body.dataset["bells"]) ?? fallbackBells;
  label.textContent = todaySchedule(bells, today).label;
  const variants = [...document.querySelectorAll<HTMLElement>("[data-variant]")];
  for (const variant of variants) {
    variant.hidden = (variant.dataset["date"] ?? "") < today;
  }
  empty.hidden = variants.some((variant) => variant.hidden === false);
}

initBellsPage();
