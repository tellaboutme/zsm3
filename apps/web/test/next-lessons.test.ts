import { describe, it } from "vitest";

import type { BellData } from "../src/lib/bells.ts";
import { nextLessons, nextLessonsText } from "../src/lib/next-lessons.ts";

const regular = [
  { number: 1, start: "07:30", end: "08:15" },
  { number: 2, start: "08:20", end: "09:05" },
];

const bells = (overrides: Partial<BellData> = {}): BellData => ({
  regular,
  variants: [],
  daysOff: [],
  ...overrides,
});

describe("nextLessons", () => {
  it("finds tomorrow on a school evening", ({ expect }) => {
    expect(nextLessons(bells(), "2026-10-22")).toEqual({ day: "2026-10-23", start: "07:30" });
  });

  it("skips the weekend from Friday and Saturday", ({ expect }) => {
    expect(nextLessons(bells(), "2026-10-23")).toEqual({ day: "2026-10-26", start: "07:30" });
    expect(nextLessons(bells(), "2026-10-24")).toEqual({ day: "2026-10-26", start: "07:30" });
  });

  it("skips days off and starts at a changed first bell", ({ expect }) => {
    const data = bells({
      daysOff: [{ from: "2026-11-02", to: "2026-11-03", title: "Dni wolne" }],
      variants: [
        {
          date: "2026-11-04",
          label: "Skrócone lekcje",
          lessons: [{ number: 1, start: "08:00", end: "08:30" }],
        },
      ],
    });

    expect(nextLessons(data, "2026-10-31")).toEqual({ day: "2026-11-04", start: "08:00" });
  });

  it("gives up when no lessons are planned for months", ({ expect }) => {
    const data = bells({ daysOff: [{ from: "2026-06-27", to: "2026-12-31", title: "Ferie" }] });

    expect(nextLessons(data, "2026-06-26")).toBeUndefined();
  });

  it("looks exactly 120 days ahead", ({ expect }) => {
    const off = (to: string): BellData =>
      bells({ daysOff: [{ from: "2026-01-02", to, title: "Długa przerwa" }] });

    expect(nextLessons(off("2026-04-30"), "2026-01-01")).toEqual({
      day: "2026-05-01",
      start: "07:30",
    });
    expect(nextLessons(off("2026-05-01"), "2026-01-01")).toBeUndefined();
  });
});

describe("nextLessonsText", () => {
  it("says tomorrow for the next calendar day", ({ expect }) => {
    expect(nextLessonsText({ day: "2026-10-23", start: "07:30" }, "2026-10-22")).toBe(
      "Następne lekcje jutro o 7:30",
    );
  });

  it("names the weekday and date further ahead", ({ expect }) => {
    expect(nextLessonsText({ day: "2026-10-26", start: "07:30" }, "2026-10-24")).toBe(
      "Następne lekcje w poniedziałek 26 października o 7:30",
    );
    expect(nextLessonsText({ day: "2026-10-27", start: "10:05" }, "2026-10-24")).toBe(
      "Następne lekcje we wtorek 27 października o 10:05",
    );
    expect(nextLessonsText({ day: "2026-10-28", start: "07:30" }, "2026-10-24")).toBe(
      "Następne lekcje w środę 28 października o 7:30",
    );
  });

  it("points to the bell page when nothing is planned", ({ expect }) => {
    expect(nextLessonsText(undefined, "2026-06-26")).toBe("Terminy lekcji w zakładce Dzwonki");
  });
});
