import { slugify } from "./news.ts";

export interface CalendarEntry {
  readonly date: string;
  readonly endDate?: string | undefined;
  readonly title: string;
  readonly note?: string | undefined;
  readonly category: string;
}

const MAX_OCTETS = 75;
const encoder = new TextEncoder();

export function escapeText(text: string): string {
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll(/\r?\n/gu, "\\n");
}

export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  for (const character of line) {
    const limit = parts.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
    if (encoder.encode(current + character).length > limit) {
      parts.push(current);
      current = character;
    } else {
      current += character;
    }
  }
  return [...parts, current].join("\r\n ");
}

export function compactDate(day: string): string {
  return day.replaceAll("-", "");
}

export function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function eventLines(entry: CalendarEntry): readonly string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${entry.date}-${slugify(entry.title)}@zespolszkolmechanicznych.edu.pl`,
    `DTSTAMP:${compactDate(entry.date)}T000000Z`,
    `DTSTART;VALUE=DATE:${compactDate(entry.date)}`,
    `DTEND;VALUE=DATE:${compactDate(nextDay(entry.endDate ?? entry.date))}`,
    `SUMMARY:${escapeText(entry.title)}`,
    ...(entry.note === undefined ? [] : [`DESCRIPTION:${escapeText(entry.note)}`]),
    `CATEGORIES:${escapeText(entry.category)}`,
    "END:VEVENT",
  ];
}

export function toIcs(name: string, entries: readonly CalendarEntry[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ZSM3 Krakow//Terminarz//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    "X-WR-TIMEZONE:Europe/Warsaw",
    ...entries.flatMap(eventLines),
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
