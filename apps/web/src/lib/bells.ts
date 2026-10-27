import type { BellSchedule } from "@zsm3/contracts/bells";
import type { SchoolEvent } from "@zsm3/contracts/content";

import { secondsOf, type Lesson } from "./live-status.ts";

export interface BellVariant {
  readonly date: string;
  readonly label: string;
  readonly lessons: readonly Lesson[];
}

export interface DaySchedule {
  readonly label: string;
  readonly lessons: readonly Lesson[];
  readonly variant: boolean;
}

export interface ScheduleRow {
  readonly lesson: Lesson;
  readonly minutes: number;
  readonly breakAfter: number | undefined;
}

export interface DayOff {
  readonly from: string;
  readonly to: string;
  readonly title: string;
}

export interface BellData {
  readonly regular: readonly Lesson[];
  readonly variants: readonly BellVariant[];
  readonly daysOff: readonly DayOff[];
}

const DAY_OFF_KINDS: ReadonlySet<string> = new Set(["wolne", "przerwa"]);

export const REGULAR_LABEL = "Zwykły plan lekcji";

export const UPCOMING_VARIANT_LIMIT = 30;

const SECONDS_PER_MINUTE = 60;

export function lessonsFrom(times: readonly (readonly [string, string])[]): readonly Lesson[] {
  return times.map(([start, end], index) => ({ number: index + 1, start, end }));
}

export function scheduleFor(
  variants: readonly BellVariant[],
  regular: readonly Lesson[],
  day: string,
): DaySchedule {
  const variant = variants.find((candidate) => candidate.date === day);
  return variant === undefined
    ? { label: REGULAR_LABEL, lessons: regular, variant: false }
    : { label: variant.label, lessons: variant.lessons, variant: true };
}

export function upcomingVariants(
  variants: readonly BellVariant[],
  day: string,
): readonly BellVariant[] {
  return variants
    .filter((variant) => variant.date >= day)
    .toSorted((first, second) => first.date.localeCompare(second.date));
}

function minutesBetween(start: string, end: string): number {
  return (secondsOf(end) - secondsOf(start)) / SECONDS_PER_MINUTE;
}

export function scheduleRows(lessons: readonly Lesson[]): readonly ScheduleRow[] {
  return lessons.map((lesson, index) => {
    const next = lessons[index + 1];
    return {
      lesson,
      minutes: minutesBetween(lesson.start, lesson.end),
      breakAfter: next === undefined ? undefined : minutesBetween(lesson.end, next.start),
    };
  });
}

function timesOf(lessons: BellSchedule["regular"]): readonly (readonly [string, string])[] {
  return lessons.map((lesson) => [lesson.start, lesson.end]);
}

export function bellData(schedule: BellSchedule, today: string): BellData {
  const definitions = new Map(schedule.variants.map((variant) => [variant.id, variant]));
  const variants = schedule.days
    .filter((day) => day.date >= today)
    .toSorted((first, second) => first.date.localeCompare(second.date))
    .slice(0, UPCOMING_VARIANT_LIMIT)
    .flatMap((day) => {
      const definition = definitions.get(day.variant);
      return definition === undefined
        ? []
        : [
            {
              date: day.date,
              label: definition.label,
              lessons: lessonsFrom(timesOf(definition.lessons)),
            },
          ];
    });
  return { regular: lessonsFrom(timesOf(schedule.regular)), variants, daysOff: [] };
}

export function daysOffFrom(
  events: readonly Pick<SchoolEvent, "date" | "endDate" | "title" | "kind">[],
  today: string,
): readonly DayOff[] {
  return events
    .filter((event) => DAY_OFF_KINDS.has(event.kind) && (event.endDate ?? event.date) >= today)
    .map((event) => ({ from: event.date, to: event.endDate ?? event.date, title: event.title }));
}

export function dayOffOn(daysOff: readonly DayOff[], day: string): DayOff | undefined {
  return daysOff.find((dayOff) => dayOff.from <= day && day <= dayOff.to);
}

export function todaySchedule(bells: BellData, day: string): DaySchedule {
  const dayOff = dayOffOn(bells.daysOff, day);
  return dayOff === undefined
    ? scheduleFor(bells.variants, bells.regular, day)
    : { label: dayOff.title, lessons: [], variant: true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLesson(value: unknown): value is Lesson {
  return (
    isRecord(value) &&
    typeof value["number"] === "number" &&
    typeof value["start"] === "string" &&
    typeof value["end"] === "string"
  );
}

function isLessons(value: unknown): value is readonly Lesson[] {
  return Array.isArray(value) && value.length > 0 && value.every(isLesson);
}

function isVariant(value: unknown): value is BellVariant {
  return (
    isRecord(value) &&
    typeof value["date"] === "string" &&
    typeof value["label"] === "string" &&
    isLessons(value["lessons"])
  );
}

function isDayOff(value: unknown): value is DayOff {
  return (
    isRecord(value) &&
    typeof value["from"] === "string" &&
    typeof value["to"] === "string" &&
    typeof value["title"] === "string"
  );
}

function parsedJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function readBellData(text: string | undefined): BellData | undefined {
  const value = text === undefined ? undefined : parsedJson(text);
  if (!isRecord(value)) {
    return undefined;
  }
  const { regular, variants, daysOff } = value;
  if (!isLessons(regular) || !Array.isArray(variants) || !variants.every(isVariant)) {
    return undefined;
  }
  if (!Array.isArray(daysOff) || !daysOff.every(isDayOff)) {
    return undefined;
  }
  return { regular, variants, daysOff };
}
