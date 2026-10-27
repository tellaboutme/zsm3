import type { SchoolEvent } from "@zsm3/contracts/content";
import { it } from "vitest";

import {
  bellData,
  daysOffFrom,
  readBellData,
  todaySchedule,
  UPCOMING_VARIANT_LIMIT,
} from "../src/lib/bells.ts";

const SCHEDULE = {
  regular: [
    { start: "07:30", end: "08:15" },
    { start: "08:20", end: "09:05" },
  ],
  variants: [
    { id: "skrocone", label: "Lekcje skrócone", lessons: [{ start: "07:30", end: "08:00" }] },
  ],
  days: [
    { date: "2026-11-05", variant: "skrocone" },
    { date: "2026-10-20", variant: "skrocone" },
    { date: "2026-10-30", variant: "skrocone" },
  ],
};

it("numbers lessons and keeps only upcoming variant days in order", ({ expect }) => {
  expect(bellData(SCHEDULE, "2026-10-26")).toEqual({
    regular: [
      { number: 1, start: "07:30", end: "08:15" },
      { number: 2, start: "08:20", end: "09:05" },
    ],
    variants: [
      {
        date: "2026-10-30",
        label: "Lekcje skrócone",
        lessons: [{ number: 1, start: "07:30", end: "08:00" }],
      },
      {
        date: "2026-11-05",
        label: "Lekcje skrócone",
        lessons: [{ number: 1, start: "07:30", end: "08:00" }],
      },
    ],
    daysOff: [],
  });
});

it("skips days whose variant is missing and caps the list", ({ expect }) => {
  expect(
    bellData({ ...SCHEDULE, days: [{ date: "2026-10-30", variant: "brak" }] }, "2026-10-26")
      .variants,
  ).toEqual([]);
  const many = [...Array.from({ length: UPCOMING_VARIANT_LIMIT + 5 }).keys()].map((index) => ({
    date: `2027-01-${String(index + 1).padStart(2, "0")}`,
    variant: "skrocone",
  }));
  expect(bellData({ ...SCHEDULE, days: many }, "2026-10-26").variants).toHaveLength(
    UPCOMING_VARIANT_LIMIT,
  );
});

it("reads the published schedule back from the page", ({ expect }) => {
  const data = bellData(SCHEDULE, "2026-10-26");
  expect(readBellData(JSON.stringify(data))).toEqual(data);
});

it("ignores a missing or damaged schedule on the page", ({ expect }) => {
  const lesson = { number: 1, start: "07:30", end: "08:15" };
  for (const text of [
    undefined,
    "{oops",
    "null",
    "[]",
    JSON.stringify({ regular: [], variants: [], daysOff: [] }),
    JSON.stringify({ regular: [{ ...lesson, number: "1" }], variants: [], daysOff: [] }),
    JSON.stringify({ regular: [{ ...lesson, start: 7 }], variants: [] }),
    JSON.stringify({ regular: [{ ...lesson, end: null }], variants: [] }),
    JSON.stringify({ regular: [lesson], variants: {} }),
    JSON.stringify({ regular: [lesson], variants: [null] }),
    JSON.stringify({ regular: [lesson], variants: [{ date: 1, label: "A", lessons: [lesson] }] }),
    JSON.stringify({ regular: [lesson], variants: [{ date: "x", label: 2, lessons: [lesson] }] }),
    JSON.stringify({ regular: [lesson], variants: [{ date: "x", label: "A", lessons: [] }] }),
    JSON.stringify({ regular: [lesson], variants: [] }),
    JSON.stringify({ regular: [lesson], variants: [], daysOff: {} }),
    JSON.stringify({
      regular: [lesson],
      variants: [],
      daysOff: [{ from: 1, to: "b", title: "c" }],
    }),
    JSON.stringify({
      regular: [lesson],
      variants: [],
      daysOff: [{ from: "a", to: 2, title: "c" }],
    }),
    JSON.stringify({
      regular: [lesson],
      variants: [],
      daysOff: [{ from: "a", to: "b", title: 3 }],
    }),
    JSON.stringify({ regular: [lesson], variants: [], daysOff: [null] }),
  ]) {
    expect(readBellData(text)).toBeUndefined();
  }
});

const EVENTS: readonly SchoolEvent[] = [
  { date: "2026-11-02", title: "Dzień wolny", kind: "wolne", audience: "Wszyscy" },
  {
    date: "2026-12-23",
    endDate: "2026-12-31",
    title: "Zimowa przerwa świąteczna",
    kind: "przerwa",
    audience: "Wszyscy",
  },
  { date: "2026-11-18", title: "Zebranie", kind: "zebranie", audience: "Rodzice" },
  { date: "2026-10-01", title: "Minione wolne", kind: "wolne", audience: "Wszyscy" },
];

it("takes upcoming days off and breaks from the calendar", ({ expect }) => {
  expect(daysOffFrom(EVENTS, "2026-11-02")).toEqual([
    { from: "2026-11-02", to: "2026-11-02", title: "Dzień wolny" },
    { from: "2026-12-23", to: "2026-12-31", title: "Zimowa przerwa świąteczna" },
  ]);
  expect(daysOffFrom(EVENTS, "2026-11-03")).toHaveLength(1);
});

it("has no lessons on a day off and keeps variants on other days", ({ expect }) => {
  const bells = { ...bellData(SCHEDULE, "2026-10-26"), daysOff: daysOffFrom(EVENTS, "2026-10-26") };
  expect(todaySchedule(bells, "2026-12-27")).toEqual({
    label: "Zimowa przerwa świąteczna",
    lessons: [],
    variant: true,
  });
  expect(todaySchedule(bells, "2026-10-30").label).toBe("Lekcje skrócone");
  expect(todaySchedule(bells, "2026-11-04").variant).toBe(false);
});
