import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  CATEGORY_TONES,
  categoryTone,
  dateParts,
  stripCount,
  stripTarget,
  stripWindow,
} from "../src/lib/news-strip.ts";

const MEASURE = { scrollLeft: 0, step: 300, viewport: 900, gap: 12, maxScroll: 1800, total: 9 };

describe("categoryTone", () => {
  it("gives one category the same tone regardless of letter case", () => {
    expect(categoryTone("Sport")).toBe(categoryTone("sport"));
    expect(categoryTone("Konkursy")).toBe(categoryTone("KONKURSY"));
  });

  it("spreads categories over the tones", () => {
    const tones = new Set(
      ["Sport", "Konkursy", "Zdrowie", "Biblioteka", "Wychowanie", "Uroczystości", "Erasmus+"].map(
        categoryTone,
      ),
    );
    expect(tones.size).toBeGreaterThan(3);
    expect(categoryTone("")).toBe(1);
    expect(categoryTone("a")).toBe((97 % CATEGORY_TONES) + 1);
    expect(categoryTone("ab")).toBe(((97 * 31 + 98) % CATEGORY_TONES) + 1);
  });

  it("always stays within the tone scale", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (category) => {
        const tone = categoryTone(category);
        expect(tone).toBeGreaterThanOrEqual(1);
        expect(tone).toBeLessThanOrEqual(CATEGORY_TONES);
        expect(Number.isInteger(tone)).toBe(true);
      }),
    );
  });

  it("keeps the hash bounded for long names", () => {
    expect(categoryTone("ż".repeat(400))).toBe(categoryTone("Ż".repeat(400)));
  });
});

describe("dateParts", () => {
  it("splits a date into the day, a short Polish month and the year", () => {
    expect(dateParts("2026-10-09")).toEqual({ day: "9", month: "paź", year: "2026" });
    expect(dateParts("2026-01-31")).toEqual({ day: "31", month: "sty", year: "2026" });
  });
});

describe("stripWindow", () => {
  it("reports the first visible cards at the start", () => {
    expect(stripWindow(MEASURE)).toEqual({ first: 0, last: 2, atStart: true, atEnd: false });
  });

  it("follows the scroll position and detects the end", () => {
    expect(stripWindow({ ...MEASURE, scrollLeft: 610 })).toEqual({
      first: 2,
      last: 4,
      atStart: false,
      atEnd: false,
    });
    expect(stripWindow({ ...MEASURE, scrollLeft: 1797 })).toEqual({
      first: 6,
      last: 8,
      atStart: false,
      atEnd: true,
    });
    expect(stripWindow({ ...MEASURE, scrollLeft: 4 }).atStart).toBe(true);
    expect(stripWindow({ ...MEASURE, scrollLeft: 5 }).atStart).toBe(false);
    expect(stripWindow({ ...MEASURE, scrollLeft: 1795 }).atEnd).toBe(false);
    expect(stripWindow({ ...MEASURE, scrollLeft: 1796 }).atEnd).toBe(true);
  });

  it("shows at least one card on a narrow screen and never passes the last card", () => {
    expect(stripWindow({ ...MEASURE, viewport: 200 })).toMatchObject({ first: 0, last: 0 });
    expect(stripWindow({ ...MEASURE, viewport: 287 })).toMatchObject({ last: 0 });
    expect(stripWindow({ ...MEASURE, viewport: 588 })).toMatchObject({ last: 1 });
    expect(stripWindow({ ...MEASURE, scrollLeft: 9000 })).toMatchObject({ first: 8, last: 8 });
  });

  it("treats an unmeasured or empty strip as complete", () => {
    const whole = { first: 0, last: 0, atStart: true, atEnd: true };
    expect(stripWindow({ ...MEASURE, step: 0 })).toEqual(whole);
    expect(stripWindow({ ...MEASURE, total: 0 })).toEqual(whole);
  });
});

describe("stripTarget and stripCount", () => {
  it("moves one card at a time inside the strip", () => {
    expect(stripTarget(0, 1, 9)).toBe(1);
    expect(stripTarget(0, -1, 9)).toBe(0);
    expect(stripTarget(8, 1, 9)).toBe(8);
    expect(stripTarget(5, -1, 9)).toBe(4);
  });

  it("counts the visible range", () => {
    expect(stripCount({ first: 0, last: 2, atStart: true, atEnd: false }, 9)).toBe("1–3 z 9");
    expect(stripCount({ first: 8, last: 8, atStart: false, atEnd: true }, 9)).toBe("9 z 9");
  });
});
