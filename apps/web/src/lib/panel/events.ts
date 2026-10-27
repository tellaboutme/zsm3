import type { SchoolEvent } from "@zsm3/contracts/content";

const AUGUST = 7;

export function schoolYearFor(date: Date): number {
  return date.getMonth() >= AUGUST ? date.getFullYear() : date.getFullYear() - 1;
}

export function yearChoices(now: Date): readonly number[] {
  const current = schoolYearFor(now);
  return [current + 1, current, current - 1, current - 2];
}

export const AUDIENCES = ["Wszyscy", "Uczniowie", "Rodzice"] as const;

export const KIND_KEYS = [
  "rok-szkolny",
  "przerwa",
  "wolne",
  "zebranie",
  "uroczystosc",
  "oceny",
  "egzamin",
  "praktyki",
] as const;

export function eventKindOf(value: string): SchoolEvent["kind"] {
  return KIND_KEYS.find((kind) => kind === value) ?? "zebranie";
}

export const KIND_LABELS: Readonly<Record<string, string>> = {
  "rok-szkolny": "Rok szkolny",
  przerwa: "Przerwa",
  wolne: "Wolne",
  zebranie: "Zebranie",
  uroczystosc: "Uroczystość",
  oceny: "Oceny",
  egzamin: "Egzamin",
  praktyki: "Praktyki",
};

export interface EventRow {
  readonly date: string;
  readonly endDate: string;
  readonly title: string;
  readonly audience: string;
  readonly kind: string;
  readonly note: string;
  readonly key: boolean;
}

export function rowFor(event: SchoolEvent): EventRow {
  return {
    date: event.date,
    endDate: event.endDate ?? "",
    title: event.title,
    audience: event.audience,
    kind: event.kind,
    note: event.note ?? "",
    key: event.key === true,
  };
}

function event(row: EventRow): SchoolEvent | undefined {
  const base: SchoolEvent = {
    date: row.date.trim(),
    title: row.title.trim(),
    audience: AUDIENCES.find((value) => value === row.audience) ?? "Wszyscy",
    kind: eventKindOf(row.kind),
  };
  if (base.date.length === 0 || base.title.length === 0) {
    return undefined;
  }
  const note = row.note.trim();
  return {
    ...base,
    ...(row.endDate.trim().length === 0 ? {} : { endDate: row.endDate.trim() }),
    ...(note.length === 0 ? {} : { note }),
    ...(row.key ? { key: true } : {}),
  };
}

export function eventsFrom(rows: readonly EventRow[]): readonly SchoolEvent[] {
  const parsed: SchoolEvent[] = [];
  for (const row of rows) {
    const candidate = event(row);
    if (candidate !== undefined) {
      parsed.push(candidate);
    }
  }
  return parsed;
}
