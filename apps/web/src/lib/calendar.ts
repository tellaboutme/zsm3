export type Audience = "Wszyscy" | "Uczniowie" | "Rodzice";

export interface SchoolEvent {
  readonly date: string;
  readonly endDate?: string;
  readonly title: string;
  readonly audience: Audience;
  readonly note?: string;
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
