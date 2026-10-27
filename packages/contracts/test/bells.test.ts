import { it } from "vitest";

import { bellScheduleSchema, bellScheduleViewSchema } from "../src/bells.ts";

const SCHEDULE = {
  regular: [
    { start: "07:30", end: "08:15" },
    { start: "08:15", end: "09:00" },
  ],
  variants: [{ id: "skrocone", label: "Skrócone", lessons: [{ start: "07:30", end: "08:00" }] }],
  days: [{ date: "2026-10-30", variant: "skrocone" }],
};

it("accepts a schedule whose days use defined variants", ({ expect }) => {
  expect(bellScheduleViewSchema.parse({ schedule: SCHEDULE }).schedule).toEqual(SCHEDULE);
});

it("rejects overlapping, reversed or malformed lessons", ({ expect }) => {
  for (const regular of [
    [],
    [{ start: "08:00", end: "08:00" }],
    [{ start: "24:00", end: "24:45" }],
    [
      { start: "08:00", end: "08:45" },
      { start: "08:44", end: "09:30" },
    ],
  ]) {
    expect(bellScheduleSchema.safeParse({ ...SCHEDULE, regular }).success).toBe(false);
  }
});

it("rejects duplicate variants, duplicate days and unknown variants", ({ expect }) => {
  for (const schedule of [
    { ...SCHEDULE, variants: [...SCHEDULE.variants, ...SCHEDULE.variants] },
    { ...SCHEDULE, days: [...SCHEDULE.days, ...SCHEDULE.days] },
    { ...SCHEDULE, days: [{ date: "2026-10-30", variant: "inne" }] },
  ]) {
    expect(bellScheduleSchema.safeParse(schedule).success).toBe(false);
  }
});
