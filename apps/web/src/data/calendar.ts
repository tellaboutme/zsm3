import type { SchoolEvent } from "../lib/calendar.ts";

export const schoolYearEvents: readonly SchoolEvent[] = [
  { date: "2026-09-09", title: "Zebrania informacyjne z rodzicami", audience: "Rodzice" },
  {
    date: "2026-10-23",
    title: "Ślubowanie klas pierwszych i Dzień Patrona",
    audience: "Wszyscy",
  },
  { date: "2026-11-18", title: "Zebrania informacyjne z rodzicami", audience: "Rodzice" },
  { date: "2026-12-21", title: "Wigilie klasowe", audience: "Uczniowie" },
  {
    date: "2026-12-23",
    endDate: "2026-12-31",
    title: "Zimowa przerwa świąteczna",
    audience: "Wszyscy",
  },
  { date: "2027-02-10", title: "Zebrania informacyjne z rodzicami", audience: "Rodzice" },
  { date: "2027-04-14", title: "Zebrania informacyjne z rodzicami", audience: "Rodzice" },
];
