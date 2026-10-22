import { lessonsFrom, type BellVariant } from "../lib/bells.ts";

const shortenedAfternoon = lessonsFrom([
  ["07:30", "08:15"],
  ["08:20", "09:05"],
  ["09:10", "09:55"],
  ["10:00", "10:45"],
  ["10:55", "11:40"],
  ["12:00", "12:45"],
  ["12:55", "13:40"],
  ["13:45", "14:30"],
  ["14:35", "15:05"],
  ["15:10", "15:40"],
  ["15:45", "16:15"],
  ["16:20", "16:50"],
  ["16:55", "17:25"],
  ["17:30", "18:00"],
]);

export const bellVariants: readonly BellVariant[] = [
  { date: "2026-09-08", label: "Lekcje skrócone od 9. lekcji", lessons: shortenedAfternoon },
  { date: "2026-09-09", label: "Lekcje skrócone od 9. lekcji", lessons: shortenedAfternoon },
];
