export const SCHOOL_TIME_ZONE = "Europe/Warsaw";
export const SCHOOL_YEAR_FIRST_MONTH = 9;

export interface SchoolWallClock {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

const wallFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCHOOL_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

function part(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  return Number(parts.find((entry) => entry.type === type)?.value);
}

export function schoolWallClock(instant: Date): SchoolWallClock {
  const parts = wallFormat.formatToParts(instant);
  return {
    year: part(parts, "year"),
    month: part(parts, "month"),
    day: part(parts, "day"),
    hour: part(parts, "hour"),
    minute: part(parts, "minute"),
    second: part(parts, "second"),
  };
}

function offsetAt(milliseconds: number): number {
  const wall = schoolWallClock(new Date(milliseconds));
  return (
    Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) -
    milliseconds
  );
}

export function schoolMidnight(year: number, month: number, day: number): Date {
  const wall = Date.UTC(year, month - 1, day);
  const estimate = wall - offsetAt(wall);
  return new Date(wall - offsetAt(estimate));
}

export function schoolYearOf(instant: Date): number {
  const wall = schoolWallClock(instant);
  return wall.month >= SCHOOL_YEAR_FIRST_MONTH ? wall.year : wall.year - 1;
}

export function shortLinkExpiry(createdAt: Date): Date {
  return schoolMidnight(schoolYearOf(createdAt) + 1, SCHOOL_YEAR_FIRST_MONTH, 1);
}
