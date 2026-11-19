import fc from "fast-check";
import { describe, it } from "vitest";

import { regularSchedule } from "../src/data/bell-schedule.ts";
import {
  clockTime,
  COUNTDOWN_LIMIT_SECONDS,
  countdown,
  describeStatus,
  liveStatus,
  secondsOf,
  warsawClock,
} from "../src/lib/live-status.ts";

const upcoming = (): string => "Następne lekcje jutro o 7:30";

const weekday = (time: string): { secondsOfDay: number; isWeekday: true } => ({
  secondsOfDay: secondsOf(time),
  isWeekday: true,
});

describe("warsawClock", () => {
  it("reads Warsaw time in winter and summer", ({ expect }) => {
    expect(warsawClock(new Date("2026-12-07T06:45:30Z"))).toEqual({
      secondsOfDay: secondsOf("07:45") + 30,
      isWeekday: true,
    });
    expect(warsawClock(new Date("2026-06-08T05:45:00Z")).secondsOfDay).toBe(secondsOf("07:45"));
  });

  it("treats Saturday and Sunday as days off", ({ expect }) => {
    expect(warsawClock(new Date("2026-10-24T09:00:00Z")).isWeekday).toBe(false);
    expect(warsawClock(new Date("2026-10-25T09:00:00Z")).isWeekday).toBe(false);
    expect(warsawClock(new Date("2026-10-26T09:00:00Z")).isWeekday).toBe(true);
  });
});

describe("liveStatus", () => {
  it("counts down to the first lesson", ({ expect }) => {
    expect(liveStatus(regularSchedule, weekday("07:00"))).toMatchObject({
      kind: "before",
      secondsLeft: 1800,
    });
  });

  it("reports the running lesson and its progress", ({ expect }) => {
    const status = liveStatus(regularSchedule, weekday("09:32"));

    expect(status).toMatchObject({ kind: "lesson", lesson: { number: 3 }, secondsLeft: 23 * 60 });
    expect(status.kind === "lesson" && status.progress).toBeCloseTo(22 / 45);
  });

  it("switches exactly at the bell", ({ expect }) => {
    expect(liveStatus(regularSchedule, weekday("08:15")).kind).toBe("break");
    expect(liveStatus(regularSchedule, weekday("08:20")).kind).toBe("lesson");
  });

  it("reports breaks with the next lesson and how far the break has run", ({ expect }) => {
    const status = liveStatus(regularSchedule, weekday("11:45"));

    expect(status).toMatchObject({ kind: "break", next: { number: 6 }, secondsLeft: 15 * 60 });
    expect(status.kind === "break" && status.progress).toBeCloseTo(5 / 20);
    expect(liveStatus(regularSchedule, weekday("08:15"))).toMatchObject({ progress: 0 });
  });

  it("ends after the last bell and on days off", ({ expect }) => {
    expect(liveStatus(regularSchedule, weekday("19:35"))).toMatchObject({
      kind: "after",
      last: { number: 14, end: "19:35" },
    });
    expect(liveStatus(regularSchedule, { secondsOfDay: 36_000, isWeekday: false }).kind).toBe(
      "day-off",
    );
    expect(liveStatus([], weekday("10:00")).kind).toBe("day-off");
  });

  it("always yields a consistent state for any second of the day", ({ expect }) => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 86_399 }), (secondsOfDay) => {
        const status = liveStatus(regularSchedule, { secondsOfDay, isWeekday: true });
        if (status.kind === "lesson" || status.kind === "break") {
          expect(status.progress).toBeGreaterThanOrEqual(0);
          expect(status.progress).toBeLessThan(1);
        }
        if (status.kind === "before" || status.kind === "break" || status.kind === "lesson") {
          expect(status.secondsLeft).toBeGreaterThan(0);
        }
      }),
    );
  });
});

describe("secondsOf", () => {
  it("parses clock times and rejects anything else", ({ expect }) => {
    expect(secondsOf("07:30")).toBe(27_000);
    expect(secondsOf("23:59")).toBe(86_340);
    expect(() => secondsOf("7:30")).toThrow(RangeError);
    expect(() => secondsOf("24:00")).toThrow("Invalid time: 24:00");
    expect(() => secondsOf("12:60")).toThrow(RangeError);
    expect(() => secondsOf("x07:30")).toThrow(RangeError);
    expect(() => secondsOf("07:305")).toThrow(RangeError);
  });
});

describe("waiting views", () => {
  it("counts down only in the last hour before the first lesson", ({ expect }) => {
    const [first] = regularSchedule;
    if (first === undefined) {
      throw new Error("schedule is empty");
    }
    const at = (secondsLeft: number): { timer: string; unit: string } => {
      const { timer, unit } = describeStatus(
        { kind: "before", next: first, secondsLeft },
        upcoming,
      );
      return { timer, unit };
    };

    expect(at(COUNTDOWN_LIMIT_SECONDS)).toEqual({ timer: "1:00:00", unit: "do dzwonka" });
    expect(at(COUNTDOWN_LIMIT_SECONDS + 1)).toEqual({ timer: "7:30", unit: "1. lekcja" });
  });
});

describe("formatting", () => {
  it("formats countdowns", ({ expect }) => {
    expect(countdown(65)).toBe("01:05");
    expect(countdown(3600 + 59)).toBe("1:00:59");
    expect(countdown(0)).toBe("00:00");
  });

  it("drops the leading zero of times", ({ expect }) => {
    expect(clockTime("07:30")).toBe("7:30");
    expect(clockTime("10:05")).toBe("10:05");
  });

  it("describes every state in Polish", ({ expect }) => {
    const [first, second] = regularSchedule;
    if (first === undefined || second === undefined) {
      throw new Error("schedule is empty");
    }

    expect(
      describeStatus({ kind: "lesson", lesson: first, secondsLeft: 90, progress: 0.5 }, upcoming),
    ).toEqual({
      state: "lesson",
      title: "1. lekcja",
      detail: "7:30–8:15",
      timer: "01:30",
      unit: "do dzwonka",
      progress: 0.5,
    });
    expect(
      describeStatus({ kind: "break", next: second, secondsLeft: 60, progress: 0.75 }, upcoming),
    ).toEqual({
      state: "break",
      title: "Przerwa",
      detail: "2. lekcja o 8:20",
      timer: "01:00",
      unit: "do dzwonka",
      progress: 0.75,
    });
    expect(describeStatus({ kind: "before", next: first, secondsLeft: 60 }, upcoming)).toEqual({
      state: "before",
      title: "Przed lekcjami",
      detail: "1. lekcja o 7:30",
      timer: "01:00",
      unit: "do dzwonka",
      progress: 0,
    });
    const idle = {
      title: "Teraz nie ma lekcji",
      detail: "Następne lekcje jutro o 7:30",
      timer: "—",
      unit: "",
      progress: 0,
    };
    expect(describeStatus({ kind: "after", last: first }, upcoming)).toEqual({
      state: "after",
      ...idle,
    });
    expect(describeStatus({ kind: "day-off" }, upcoming)).toEqual({ state: "day-off", ...idle });
  });
});
