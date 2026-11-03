import { describe, it } from "vitest";

import {
  SCHOOL_TIME_ZONE,
  SCHOOL_YEAR_FIRST_MONTH,
  schoolMidnight,
  schoolWallClock,
  schoolYearOf,
  shortLinkExpiry,
} from "../src/short-link-expiry.ts";

function expiry(createdAt: string): string {
  return shortLinkExpiry(new Date(createdAt)).toISOString();
}

describe("school wall clock", () => {
  it("reads the Warsaw date and time of an instant, not the host's", ({ expect }) => {
    expect(SCHOOL_TIME_ZONE).toBe("Europe/Warsaw");
    expect(schoolWallClock(new Date("2026-12-31T23:30:15.000Z"))).toEqual({
      year: 2027,
      month: 1,
      day: 1,
      hour: 0,
      minute: 30,
      second: 15,
    });
    expect(schoolWallClock(new Date("2027-07-10T22:05:09.000Z"))).toEqual({
      year: 2027,
      month: 7,
      day: 11,
      hour: 0,
      minute: 5,
      second: 9,
    });
  });
});

describe("school midnight", () => {
  it("uses the winter offset in winter and the summer offset in summer", ({ expect }) => {
    expect(schoolMidnight(2027, 1, 1).toISOString()).toBe("2026-12-31T23:00:00.000Z");
    expect(schoolMidnight(2027, 9, 1).toISOString()).toBe("2027-08-31T22:00:00.000Z");
  });

  it("keeps the offset of midnight on the days the clocks change", ({ expect }) => {
    expect(schoolMidnight(2027, 3, 28).toISOString()).toBe("2027-03-27T23:00:00.000Z");
    expect(schoolMidnight(2027, 3, 29).toISOString()).toBe("2027-03-28T22:00:00.000Z");
    expect(schoolMidnight(2026, 10, 25).toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(schoolMidnight(2026, 10, 26).toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
});

describe("school year of an instant", () => {
  it("starts on the first of September in Warsaw", ({ expect }) => {
    expect(SCHOOL_YEAR_FIRST_MONTH).toBe(9);
    expect(schoolYearOf(new Date("2027-08-31T21:59:59.999Z"))).toBe(2026);
    expect(schoolYearOf(new Date("2027-08-31T22:00:00.000Z"))).toBe(2027);
    expect(schoolYearOf(new Date("2027-01-15T12:00:00.000Z"))).toBe(2026);
    expect(schoolYearOf(new Date("2026-12-31T12:00:00.000Z"))).toBe(2026);
  });
});

describe("short link expiry", () => {
  it("ends at the start of the next first of September in Warsaw", ({ expect }) => {
    expect(expiry("2026-11-03T10:00:00.000Z")).toBe("2027-08-31T22:00:00.000Z");
  });

  it("gives a link made on the last day of the school year only the rest of that day", ({
    expect,
  }) => {
    expect(expiry("2027-08-31T05:00:00.000Z")).toBe("2027-08-31T22:00:00.000Z");
    expect(expiry("2027-08-31T21:59:59.999Z")).toBe("2027-08-31T22:00:00.000Z");
  });

  it("moves a link made on the first of September to the following school year", ({ expect }) => {
    expect(expiry("2027-08-31T22:00:00.000Z")).toBe("2028-08-31T22:00:00.000Z");
    expect(expiry("2027-09-01T10:00:00.000Z")).toBe("2028-08-31T22:00:00.000Z");
  });

  it("follows the Warsaw date where it differs from the UTC date", ({ expect }) => {
    expect(expiry("2026-08-31T22:30:00.000Z")).toBe("2027-08-31T22:00:00.000Z");
    expect(expiry("2026-08-31T21:30:00.000Z")).toBe("2026-08-31T22:00:00.000Z");
  });

  it("is unaffected by year rollover, leap days and clock changes", ({ expect }) => {
    expect(expiry("2026-12-31T23:30:00.000Z")).toBe("2027-08-31T22:00:00.000Z");
    expect(expiry("2028-02-29T12:00:00.000Z")).toBe("2028-08-31T22:00:00.000Z");
    expect(expiry("2027-03-28T00:59:59.000Z")).toBe("2027-08-31T22:00:00.000Z");
    expect(expiry("2027-03-28T01:00:00.000Z")).toBe("2027-08-31T22:00:00.000Z");
    expect(expiry("2026-10-25T00:30:00.000Z")).toBe("2027-08-31T22:00:00.000Z");
    expect(expiry("2026-10-25T01:30:00.000Z")).toBe("2027-08-31T22:00:00.000Z");
  });

  it("is always later than the moment the link is made", ({ expect }) => {
    const start = Date.parse("2026-01-01T00:00:00.000Z");
    for (let hour = 0; hour < 24 * 800; hour += 7) {
      const createdAt = new Date(start + hour * 3_600_000);
      const ends = shortLinkExpiry(createdAt);
      expect(ends.getTime()).toBeGreaterThan(createdAt.getTime());
      expect(ends.getTime() - createdAt.getTime()).toBeLessThanOrEqual(366 * 86_400_000);
      expect(schoolWallClock(ends)).toMatchObject({ month: 9, day: 1, hour: 0, minute: 0 });
    }
  });
});
