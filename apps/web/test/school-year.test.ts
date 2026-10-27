import { describe, it } from "vitest";

import { schoolYearName, schoolYearStart } from "../src/lib/calendar.ts";
import { eventEntry } from "../src/lib/search-sources.ts";

describe("school year helpers", () => {
  it("starts the school year in August", ({ expect }) => {
    expect(schoolYearStart("2026-08-01")).toBe(2026);
    expect(schoolYearStart("2026-07-31")).toBe(2025);
    expect(schoolYearStart("2027-01-15")).toBe(2026);
    expect(schoolYearName("2026-10-26")).toBe("2026/2027");
  });

  it("indexes a calendar entry for search", ({ expect }) => {
    expect(
      eventEntry({ date: "2026-11-18", title: "Zebranie", audience: "Rodzice", kind: "zebranie" }),
    ).toEqual({
      type: "termin",
      title: "Zebranie",
      href: "/szkola/terminarz",
      text: "18 listopada 2026  Rodzice",
    });
  });
});
