export interface Lesson {
  readonly number: number;
  readonly start: string;
  readonly end: string;
}

export type LiveStatus =
  | { readonly kind: "day-off" }
  | { readonly kind: "before"; readonly next: Lesson; readonly secondsLeft: number }
  | {
      readonly kind: "lesson";
      readonly lesson: Lesson;
      readonly secondsLeft: number;
      readonly progress: number;
    }
  | { readonly kind: "break"; readonly next: Lesson; readonly secondsLeft: number }
  | { readonly kind: "after"; readonly last: Lesson };

export interface SchoolClock {
  readonly secondsOfDay: number;
  readonly isWeekday: boolean;
}

export interface LiveView {
  readonly state: LiveStatus["kind"];
  readonly title: string;
  readonly detail: string;
  readonly timer: string;
  readonly progress: number;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const WEEKEND = new Set(["Sat", "Sun"]);

const TIME = /^(?<hours>[01]\d|2[0-3]):(?<minutes>[0-5]\d)$/u;

export function secondsOf(time: string): number {
  const groups = TIME.exec(time)?.groups;
  if (groups === undefined) {
    throw new RangeError(`Invalid time: ${time}`);
  }
  return (
    Number(groups["hours"]) * SECONDS_PER_HOUR + Number(groups["minutes"]) * SECONDS_PER_MINUTE
  );
}

export function warsawClock(now: Date): SchoolClock {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = new Map(parts.map((item) => [item.type, item.value]));
  return {
    secondsOfDay:
      Number(part.get("hour")) * SECONDS_PER_HOUR +
      Number(part.get("minute")) * SECONDS_PER_MINUTE +
      Number(part.get("second")),
    isWeekday: !WEEKEND.has(String(part.get("weekday"))),
  };
}

function duringDay(schedule: readonly Lesson[], now: number): LiveStatus | undefined {
  for (const [index, lesson] of schedule.entries()) {
    const start = secondsOf(lesson.start);
    const end = secondsOf(lesson.end);
    if (now < start) {
      return index === 0
        ? { kind: "before", next: lesson, secondsLeft: start - now }
        : { kind: "break", next: lesson, secondsLeft: start - now };
    }
    if (now < end) {
      const progress = (now - start) / (end - start);
      return { kind: "lesson", lesson, secondsLeft: end - now, progress };
    }
  }
  return undefined;
}

export function liveStatus(schedule: readonly Lesson[], clock: SchoolClock): LiveStatus {
  const last = schedule.at(-1);
  if (!clock.isWeekday || last === undefined) {
    return { kind: "day-off" };
  }
  return duringDay(schedule, clock.secondsOfDay) ?? { kind: "after", last };
}

export function countdown(seconds: number): string {
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const rest = seconds % SECONDS_PER_MINUTE;
  const pad = (value: number): string => String(value).padStart(2, "0");
  const tail = `${pad(minutes)}:${pad(rest)}`;
  return hours > 0 ? `${String(hours)}:${tail}` : tail;
}

export function clockTime(time: string): string {
  return time.replace(/^0/u, "");
}

type Waiting = Extract<LiveStatus, { kind: "break" | "before" }>;

function waiting(status: Waiting): LiveView {
  return {
    state: status.kind,
    title: status.kind === "break" ? "Przerwa" : "Przed lekcjami",
    detail: `${String(status.next.number)}. lekcja o ${clockTime(status.next.start)}`,
    timer: countdown(status.secondsLeft),
    progress: 0,
  };
}

export function describeStatus(status: LiveStatus): LiveView {
  switch (status.kind) {
    case "lesson": {
      const { lesson } = status;
      return {
        state: status.kind,
        title: `${String(lesson.number)}. lekcja`,
        detail: `${clockTime(lesson.start)}–${clockTime(lesson.end)}`,
        timer: countdown(status.secondsLeft),
        progress: status.progress,
      };
    }
    case "break":
    case "before":
      return waiting(status);
    case "after":
      return {
        state: status.kind,
        title: "Po lekcjach",
        detail: `Ostatni dzwonek o ${clockTime(status.last.end)}`,
        timer: "—",
        progress: 1,
      };
    case "day-off":
      return {
        state: status.kind,
        title: "Dziś nie ma zajęć",
        detail: "Lekcje w dni nauki od 7:30",
        timer: "—",
        progress: 0,
      };
  }
}
