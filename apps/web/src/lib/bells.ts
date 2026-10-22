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

export const REGULAR_LABEL = "Zwykły plan lekcji";

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
