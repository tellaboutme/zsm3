import type { BellData } from "../lib/bells.ts";
import type { Lesson } from "../lib/live-status.ts";

export const regularSchedule: readonly Lesson[] = [
  { number: 1, start: "07:30", end: "08:15" },
  { number: 2, start: "08:20", end: "09:05" },
  { number: 3, start: "09:10", end: "09:55" },
  { number: 4, start: "10:00", end: "10:45" },
  { number: 5, start: "10:55", end: "11:40" },
  { number: 6, start: "12:00", end: "12:45" },
  { number: 7, start: "12:55", end: "13:40" },
  { number: 8, start: "13:45", end: "14:30" },
  { number: 9, start: "14:35", end: "15:20" },
  { number: 10, start: "15:30", end: "16:15" },
  { number: 11, start: "16:20", end: "17:05" },
  { number: 12, start: "17:10", end: "17:55" },
  { number: 13, start: "18:00", end: "18:45" },
  { number: 14, start: "18:50", end: "19:35" },
];

export const fallbackBells: BellData = { regular: regularSchedule, variants: [], daysOff: [] };
