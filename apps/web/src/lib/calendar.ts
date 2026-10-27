import type { SchoolEvent as ContractEvent } from "@zsm3/contracts/content";

export type Audience = "Wszyscy" | "Uczniowie" | "Rodzice";

export const eventKinds = [
  "rok-szkolny",
  "przerwa",
  "wolne",
  "zebranie",
  "uroczystosc",
  "oceny",
  "egzamin",
  "praktyki",
] as const;

export type EventKind = (typeof eventKinds)[number];

export const eventKindLabels: Readonly<Record<EventKind, string>> = {
  "rok-szkolny": "Rok szkolny",
  przerwa: "Przerwy",
  wolne: "Dni wolne",
  zebranie: "Zebrania z rodzicami",
  uroczystosc: "Uroczystości",
  oceny: "Oceny i klasyfikacja",
  egzamin: "Egzaminy",
  praktyki: "Praktyki zawodowe",
};

export type SchoolEvent = ContractEvent;

export interface MonthGroup {
  readonly month: string;
  readonly label: string;
  readonly events: readonly SchoolEvent[];
}

export function warsawDay(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" });
}

export function isoDay(date: Date): string {
  return warsawDay().format(date);
}

export function polishDate(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function longDate(isoDate: string): string {
  return polishDate().format(new Date(`${isoDate}T12:00:00Z`));
}

export interface Dated {
  readonly date: string;
  readonly endDate?: string | undefined;
}

export function upcomingEvents<Event extends Dated>(
  events: readonly Event[],
  today: string,
  count: number,
): readonly Event[] {
  return events
    .filter((event) => (event.endDate ?? event.date) >= today)
    .toSorted((first, second) => first.date.localeCompare(second.date))
    .slice(0, count);
}

export function nextEvent(
  events: readonly SchoolEvent[],
  today: string,
  audience: Audience,
): SchoolEvent | undefined {
  return events
    .filter((event) => event.audience === audience && (event.endDate ?? event.date) >= today)
    .toSorted((first, second) => first.date.localeCompare(second.date))
    .at(0);
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-15T12:00:00Z`));
}

export function byMonth(events: readonly SchoolEvent[]): readonly MonthGroup[] {
  const sorted = events.toSorted((first, second) => first.date.localeCompare(second.date));
  const months = [...new Set(sorted.map((event) => event.date.slice(0, 7)))];
  return months.map((month) => ({
    month,
    label: monthLabel(month),
    events: sorted.filter((event) => event.date.startsWith(month)),
  }));
}

export type AudienceFilter = "wszyscy" | "Uczniowie" | "Rodzice";

export type KindFilter = EventKind | "wszystkie";

export function isAudienceFilter(value: string | undefined): value is AudienceFilter {
  return value === "wszyscy" || value === "Uczniowie" || value === "Rodzice";
}

export function isKindFilter(value: string | undefined): value is KindFilter {
  return value === "wszystkie" || eventKinds.some((kind) => kind === value);
}

export function matchesCalendarFilter(
  event: { readonly audience: string | undefined; readonly kind: string | undefined },
  audience: AudienceFilter,
  kind: KindFilter,
): boolean {
  const forAudience =
    audience === "wszyscy" || event.audience === audience || event.audience === "Wszyscy";
  return forAudience && (kind === "wszystkie" || event.kind === kind);
}

export function schoolYearStart(day: string): number {
  const year = Number(day.slice(0, 4));
  return day.slice(5, 7) >= "08" ? year : year - 1;
}

export function schoolYearName(day: string): string {
  const start = schoolYearStart(day);
  return `${String(start)}/${String(start + 1)}`;
}
