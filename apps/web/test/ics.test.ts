import fc from "fast-check";
import { describe, it } from "vitest";

import { compactDate, escapeText, foldLine, nextDay, toIcs } from "../src/lib/ics.ts";

const encoder = new TextEncoder();

describe("ics", () => {
  it("escapes text values", ({ expect }) => {
    expect(escapeText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });

  it("folds long lines at 75 octets without splitting characters", ({ expect }) => {
    const line = `SUMMARY:${"ż".repeat(60)}`;
    const folded = foldLine(line);
    const parts = folded.split("\r\n");

    expect(parts.length).toBeGreaterThan(1);
    expect(encoder.encode(parts[0]).length).toBeLessThanOrEqual(75);
    for (const part of parts.slice(1)) {
      expect(part.startsWith(" ")).toBe(true);
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replaceAll("\r\n ", "")).toBe(line);
    expect(foldLine("SHORT:1")).toBe("SHORT:1");
  });

  it("fills every folded line to exactly 75 octets", ({ expect }) => {
    const parts = foldLine("X".repeat(200)).split("\r\n");

    expect(parts.map((part) => part.length)).toEqual([75, 75, 52]);
    expect(foldLine("Y".repeat(75))).toBe("Y".repeat(75));
    expect(foldLine("Z".repeat(76))).toBe(`${"Z".repeat(75)}\r\n Z`);
  });

  it("keeps every folded line within the limit for any text", ({ expect }) => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (text) => {
        const folded = foldLine(`DESCRIPTION:${text}`);

        expect(folded.replaceAll("\r\n ", "")).toBe(`DESCRIPTION:${text}`);
        for (const part of folded.split("\r\n")) {
          expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
        }
      }),
    );
  });

  it("formats dates and the exclusive end date", ({ expect }) => {
    expect(compactDate("2026-12-23")).toBe("20261223");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
  });

  it("writes a complete calendar with CRLF line endings", ({ expect }) => {
    const ics = toIcs("Terminarz; test", [
      {
        date: "2026-12-23",
        endDate: "2026-12-31",
        title: "Przerwa, świąteczna",
        category: "Przerwy",
      },
      { date: "2027-05-04", title: "Matura", note: "Dzień wolny.", category: "Egzaminy" },
    ]);
    const lines = ics.split("\r\n");

    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replaceAll("\r\n", "")).not.toContain("\n");
    expect(lines.slice(0, 7)).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ZSM3 Krakow//Terminarz//PL",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Terminarz\\; test",
      "X-WR-TIMEZONE:Europe/Warsaw",
    ]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261223\r\nDTEND;VALUE=DATE:20270101\r\n");
    expect(ics).toContain("SUMMARY:Przerwa\\, świąteczna\r\n");
    expect(ics).toContain("DTSTAMP:20261223T000000Z\r\n");
    expect(ics).toContain("UID:2027-05-04-matura@zespolszkolmechanicznych.edu.pl\r\n");
    expect(ics).toContain("DESCRIPTION:Dzień wolny.\r\nCATEGORIES:Egzaminy\r\n");
    expect(ics.match(/BEGIN:VEVENT/gu)).toHaveLength(2);
    expect(ics.match(/END:VEVENT\r\n/gu)).toHaveLength(2);
    expect(lines.slice(7, 16)).toEqual([
      "BEGIN:VEVENT",
      "UID:2026-12-23-przerwa-swiateczna@zespolszkolmechanicznych.edu.pl",
      "DTSTAMP:20261223T000000Z",
      "DTSTART;VALUE=DATE:20261223",
      "DTEND;VALUE=DATE:20270101",
      "SUMMARY:Przerwa\\, świąteczna",
      "CATEGORIES:Przerwy",
      "END:VEVENT",
      "BEGIN:VEVENT",
    ]);
    expect(ics.match(/DESCRIPTION/gu)).toHaveLength(1);
    expect(lines.at(-2)).toBe("END:VCALENDAR");
  });
});
