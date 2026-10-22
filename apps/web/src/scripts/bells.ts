import { regularSchedule } from "../data/bell-schedule.ts";
import { bellVariants } from "../data/bell-variants.ts";
import { scheduleFor } from "../lib/bells.ts";
import { isoDay } from "../lib/calendar.ts";

function initBellsPage(): void {
  const label = document.querySelector("[data-today-label]");
  const empty = document.querySelector<HTMLElement>("[data-no-variants]");
  if (label === null || empty === null) {
    return;
  }
  const today = isoDay(new Date());
  label.textContent = scheduleFor(bellVariants, regularSchedule, today).label;
  const variants = [...document.querySelectorAll<HTMLElement>("[data-variant]")];
  for (const variant of variants) {
    variant.hidden = (variant.dataset["date"] ?? "") < today;
  }
  empty.hidden = variants.some((variant) => variant.hidden === false);
}

initBellsPage();
