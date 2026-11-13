export interface DatePlaque {
  readonly day: string;
  readonly month: string;
  readonly range: boolean;
}

const MONTHS = [
  "sty",
  "lut",
  "mar",
  "kwi",
  "maj",
  "cze",
  "lip",
  "sie",
  "wrz",
  "paź",
  "lis",
  "gru",
] as const;

export function monthAbbreviation(isoDate: string): string {
  const name = MONTHS[Number(isoDate.slice(5, 7)) - 1];
  if (name === undefined) {
    throw new RangeError(`Not an ISO date: ${isoDate}`);
  }
  return name;
}

function dayOf(isoDate: string): string {
  return String(Number(isoDate.slice(8, 10)));
}

export function datePlaque(date: string, endDate: string | undefined): DatePlaque {
  const month = monthAbbreviation(date);
  if (endDate === undefined || endDate === date || endDate.slice(0, 7) !== date.slice(0, 7)) {
    return { day: dayOf(date), month, range: false };
  }
  return { day: `${dayOf(date)}–${dayOf(endDate)}`, month, range: true };
}
