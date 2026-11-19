export const CATEGORY_TONES = 6;

const SHORT_MONTH = new Intl.DateTimeFormat("pl-PL", { month: "short", timeZone: "UTC" });

export interface DateParts {
  readonly day: string;
  readonly month: string;
  readonly year: string;
}

export interface StripWindow {
  readonly first: number;
  readonly last: number;
  readonly atStart: boolean;
  readonly atEnd: boolean;
}

export interface StripMeasure {
  readonly scrollLeft: number;
  readonly step: number;
  readonly viewport: number;
  readonly gap: number;
  readonly maxScroll: number;
  readonly total: number;
}

const EDGE = 4;

export function categoryTone(category: string): number {
  let hash = 0;
  for (const char of category.toLocaleLowerCase("pl-PL")) {
    hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  }
  return (hash % CATEGORY_TONES) + 1;
}

export function dateParts(isoDate: string): DateParts {
  const date = new Date(`${isoDate}T12:00:00Z`);
  return {
    day: String(date.getUTCDate()),
    month: SHORT_MONTH.format(date).replace(/\.$/u, ""),
    year: String(date.getUTCFullYear()),
  };
}

export function stripWindow(measure: StripMeasure): StripWindow {
  if (measure.step <= 0 || measure.total === 0) {
    return { first: 0, last: 0, atStart: true, atEnd: true };
  }
  const first = Math.min(measure.total - 1, Math.round(measure.scrollLeft / measure.step));
  const visible = Math.max(1, Math.floor((measure.viewport + measure.gap) / measure.step));
  return {
    first,
    last: Math.min(measure.total - 1, first + visible - 1),
    atStart: measure.scrollLeft <= EDGE,
    atEnd: measure.scrollLeft >= measure.maxScroll - EDGE,
  };
}

export function stripTarget(current: number, direction: -1 | 1, total: number): number {
  return Math.max(0, Math.min(total - 1, current + direction));
}

export function stripCount({ first, last }: StripWindow, total: number): string {
  const range = first === last ? String(first + 1) : `${String(first + 1)}–${String(last + 1)}`;
  return `${range} z ${String(total)}`;
}
