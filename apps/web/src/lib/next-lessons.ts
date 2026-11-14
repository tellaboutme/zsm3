import { todaySchedule, type BellData } from "./bells.ts";
import { clockTime } from "./live-status.ts";

const SEARCH_DAYS = 120;
const MS_PER_DAY = 86_400_000;
const WEEKEND_DAYS: ReadonlySet<number> = new Set([0, 6]);

const weekdayName = new Intl.DateTimeFormat("pl-PL", { weekday: "long", timeZone: "UTC" });

const dayAndMonth = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export interface NextLessons {
  readonly day: string;
  readonly start: string;
}

function onWeekday(date: Date): string {
  const accusative = weekdayName.format(date).replace(/a$/u, "ę");
  return `${accusative.startsWith("w") ? "we" : "w"} ${accusative}`;
}

function noon(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

function shifted(day: string, days: number): string {
  return new Date(noon(day).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export function nextLessons(bells: BellData, today: string): NextLessons | undefined {
  for (let offset = 1; offset <= SEARCH_DAYS; offset += 1) {
    const day = shifted(today, offset);
    const first = todaySchedule(bells, day).lessons[0];
    if (!WEEKEND_DAYS.has(noon(day).getUTCDay()) && first !== undefined) {
      return { day, start: first.start };
    }
  }
  return undefined;
}

export function nextLessonsText(next: NextLessons | undefined, today: string): string {
  if (next === undefined) {
    return "Terminy lekcji w zakładce Dzwonki";
  }
  const when =
    next.day === shifted(today, 1)
      ? "jutro"
      : `${onWeekday(noon(next.day))} ${dayAndMonth.format(noon(next.day))}`;
  return `Następne lekcje ${when} o ${clockTime(next.start)}`;
}
