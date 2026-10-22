import type { SchoolEvent } from "../../lib/calendar.ts";

export const firstTerm: readonly SchoolEvent[] = [
  {
    date: "2026-09-01",
    title: "Uroczyste rozpoczęcie roku szkolnego",
    audience: "Wszyscy",
    kind: "rok-szkolny",
    note: "Godz. 9:00.",
    key: true,
  },
  {
    date: "2026-09-07",
    endDate: "2026-10-02",
    title: "Praktyki zawodowe klas czwartych",
    audience: "Uczniowie",
    kind: "praktyki",
    note: "Klasy 4 Tb, 4 Td, 4 Tc, 4 Tp.",
  },
  {
    date: "2026-09-09",
    title: "Zebrania informacyjne z rodzicami",
    audience: "Rodzice",
    kind: "zebranie",
  },
  {
    date: "2026-10-05",
    endDate: "2026-10-30",
    title: "Praktyki zawodowe klas trzecich i czwartych",
    audience: "Uczniowie",
    kind: "praktyki",
    note: "Klasy 3 Ta/d, 3 Tb, 3 Tm/s, 3 Tp, 4 Ta/m, 4 Ts.",
  },
  { date: "2026-10-14", title: "Dzień Edukacji Narodowej", audience: "Wszyscy", kind: "wolne" },
  {
    date: "2026-10-15",
    title: "Dzień wolny od zajęć dydaktycznych",
    audience: "Wszyscy",
    kind: "wolne",
  },
  {
    date: "2026-10-23",
    title: "Ślubowanie klas pierwszych i Dzień Patrona",
    audience: "Wszyscy",
    kind: "uroczystosc",
  },
  {
    date: "2026-11-18",
    title: "Zebrania informacyjne z rodzicami",
    audience: "Rodzice",
    kind: "zebranie",
  },
  {
    date: "2026-12-18",
    title: "Oceny śródroczne klas piątych i BS II",
    audience: "Uczniowie",
    kind: "oceny",
  },
  { date: "2026-12-21", title: "Wigilie klasowe", audience: "Uczniowie", kind: "uroczystosc" },
  {
    date: "2026-12-22",
    title: "Dzień wolny od zajęć dydaktycznych",
    audience: "Wszyscy",
    kind: "wolne",
  },
  {
    date: "2026-12-23",
    endDate: "2026-12-31",
    title: "Zimowa przerwa świąteczna",
    audience: "Wszyscy",
    kind: "przerwa",
    key: true,
  },
];
