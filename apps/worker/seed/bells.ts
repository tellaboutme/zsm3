import { bellScheduleSchema, type BellSchedule } from "@zsm3/contracts/bells";
import type { SchoolEvent } from "@zsm3/contracts/content";

const REGULAR: readonly (readonly [string, string])[] = [
  ["07:30", "08:15"],
  ["08:20", "09:05"],
  ["09:10", "09:55"],
  ["10:00", "10:45"],
  ["10:55", "11:40"],
  ["12:00", "12:45"],
  ["12:55", "13:40"],
  ["13:45", "14:30"],
  ["14:35", "15:20"],
  ["15:30", "16:15"],
  ["16:20", "17:05"],
  ["17:10", "17:55"],
  ["18:00", "18:45"],
  ["18:50", "19:35"],
];

const SHORTENED_AFTERNOON: readonly (readonly [string, string])[] = [
  ...REGULAR.slice(0, 8),
  ["14:35", "15:05"],
  ["15:10", "15:40"],
  ["15:45", "16:15"],
  ["16:20", "16:50"],
  ["16:55", "17:25"],
  ["17:30", "18:00"],
];

const DAY_MS = 86_400_000;
const FIRST_SHORTENED_IN_DAYS = 7;
const SHORTENED_DAYS = 2;
const WEEKEND = new Set([0, 6]);
const DAY_OFF_KINDS = new Set(["wolne", "przerwa"]);

function lessons(times: readonly (readonly [string, string])[]): BellSchedule["regular"] {
  return times.map(([start, end]) => ({ start, end }));
}

function isSchoolDay(day: Date, calendar: readonly SchoolEvent[]): boolean {
  const iso = day.toISOString().slice(0, 10);
  return (
    !WEEKEND.has(day.getUTCDay()) &&
    !calendar.some(
      (event) =>
        DAY_OFF_KINDS.has(event.kind) && event.date <= iso && iso <= (event.endDate ?? event.date),
    )
  );
}

function schoolDaysFrom(now: Date, calendar: readonly SchoolEvent[]): readonly string[] {
  const days: string[] = [];
  for (let offset = FIRST_SHORTENED_IN_DAYS; days.length < SHORTENED_DAYS; offset += 1) {
    const day = new Date(now.getTime() + offset * DAY_MS);
    if (isSchoolDay(day, calendar)) {
      days.push(day.toISOString().slice(0, 10));
    }
  }
  return days;
}

export function seedBells(now: Date, calendar: readonly SchoolEvent[]): BellSchedule {
  return bellScheduleSchema.parse({
    regular: lessons(REGULAR),
    variants: [
      {
        id: "skrocone-od-9",
        label: "Lekcje skrócone od 9. lekcji",
        lessons: lessons(SHORTENED_AFTERNOON),
      },
    ],
    days: schoolDaysFrom(now, calendar).map((date) => ({ date, variant: "skrocone-od-9" })),
  });
}
