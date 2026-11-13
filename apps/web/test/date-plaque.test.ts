import { describe, it } from "vitest";

import { datePlaque, monthAbbreviation } from "../src/lib/date-plaque.ts";

describe("month abbreviation", () => {
  it("gives the short Polish month without a trailing dot", ({ expect }) => {
    expect(
      ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((month) =>
        monthAbbreviation(`2026-${month}-15`),
      ),
    ).toEqual(["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"]);
  });

  it("rejects a value that is not a month", ({ expect }) => {
    expect(() => monthAbbreviation("2026-13-01")).toThrow(
      new RangeError("Not an ISO date: 2026-13-01"),
    );
    expect(() => monthAbbreviation("2026-00-01")).toThrow(RangeError);
  });
});

describe("date plaque", () => {
  it("shows a single day with its month", ({ expect }) => {
    expect(datePlaque("2026-11-18", undefined)).toEqual({ day: "18", month: "lis", range: false });
  });

  it("treats a range ending on the same day as a single day", ({ expect }) => {
    expect(datePlaque("2026-11-18", "2026-11-18")).toEqual({
      day: "18",
      month: "lis",
      range: false,
    });
  });

  it("compresses a range within one month", ({ expect }) => {
    expect(datePlaque("2026-12-23", "2026-12-31")).toEqual({
      day: "23–31",
      month: "gru",
      range: true,
    });
  });

  it("shows only the start of a range that crosses months", ({ expect }) => {
    expect(datePlaque("2027-01-28", "2027-02-02")).toEqual({
      day: "28",
      month: "sty",
      range: false,
    });
  });

  it("shows only the start of a range that crosses years", ({ expect }) => {
    expect(datePlaque("2026-12-23", "2027-01-03")).toEqual({
      day: "23",
      month: "gru",
      range: false,
    });
  });

  it("keeps a same month in a different year apart", ({ expect }) => {
    expect(datePlaque("2026-12-30", "2027-12-02")).toEqual({
      day: "30",
      month: "gru",
      range: false,
    });
  });

  it("drops leading zeros from days", ({ expect }) => {
    expect(datePlaque("2026-09-01", "2026-09-05").day).toBe("1–5");
  });
});
