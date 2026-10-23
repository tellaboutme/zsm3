import { describe, it } from "vitest";

import {
  markedSpans,
  snippet,
  SNIPPET_LEAD,
  SNIPPET_LENGTH,
  windowFor,
} from "../src/lib/search-snippet.ts";

const joined = (text: string, query: string): string =>
  snippet(text, query)
    .map((segment) => (segment.marked ? `[${segment.text}]` : segment.text))
    .join("");

describe("search snippets", () => {
  it("marks matching words, class codes and synonyms", ({ expect }) => {
    expect(joined("Klasy 4 Tb, 4 Tp. Uczniowie", "4TP")).toBe("Klasy 4 Tb, [4 Tp]. Uczniowie");
    expect(joined("Dzwonek o 8:00", "dzwonki")).toBe("[Dzwonek] o 8:00");
    expect(joined("Przedmioty lotnicze", "samolot")).toBe("Przedmioty [lotnicze]");
    expect(joined("Bez trafień", "zebranie")).toBe("Bez trafień");
    expect(joined("", "cokolwiek")).toBe("");
    expect(joined("Sala 120 i sala 121", "sala")).toBe("[Sala] 120 i [sala] 121");
  });

  it("returns the spans of marked words", ({ expect }) => {
    expect(markedSpans("Sala 4 Tp", ["4tp"])).toEqual([{ start: 5, end: 9 }]);
    expect(markedSpans("Sala 4", ["4tp"])).toEqual([]);
    expect(markedSpans("Sala 121", ["sala"])).toEqual([{ start: 0, end: 4 }]);
    expect(markedSpans("Sala 121", ["sala", "dzwonki"])).toEqual([{ start: 0, end: 4 }]);
    expect(markedSpans("Sala 4 Tp", ["4tp", "tp"])).toEqual([{ start: 5, end: 9 }]);
  });

  it("cuts long text at word boundaries around the first match", ({ expect }) => {
    const words = "xxxxxxxxx ".repeat(30);

    expect(windowFor("a".repeat(150), { start: 120, end: 130 })).toEqual({ start: 0, end: 150 });
    expect(windowFor("xxxxxxxxx ".repeat(16), { start: 120, end: 129 })).toEqual({
      start: 0,
      end: 160,
    });
    expect(windowFor(words, { start: 150, end: 159 })).toEqual({ start: 90, end: 249 });
    expect(windowFor(words, { start: 200, end: 209 })).toEqual({ start: 140, end: 300 });
    expect(windowFor("y".repeat(400), undefined)).toEqual({ start: 0, end: 160 });
    expect(windowFor(`${"b".repeat(100)}  ${"c".repeat(300)}`, { start: 160, end: 170 })).toEqual({
      start: 101,
      end: 261,
    });
  });

  it("marks only the matches inside the window", ({ expect }) => {
    const text = `legitymacja ${"słowo ".repeat(60)}legitymacja`;

    expect(snippet(text, "legitymacja").filter((segment) => segment.marked)).toHaveLength(1);
  });

  it("shows a window around the first match in long text", ({ expect }) => {
    expect([SNIPPET_LENGTH, SNIPPET_LEAD]).toEqual([160, 60]);
    const filler = [...Array.from({ length: 40 }).keys()]
      .map((index) => `słowo${String(index)}`)
      .join(" ");
    const text = `${filler} legitymacja ${filler}`;
    const segments = snippet(text, "legitymacja");
    const shown = segments.map((segment) => segment.text).join("");

    expect(segments[0]).toEqual({ text: "…", marked: false });
    expect(segments.at(-1)).toEqual({ text: "…", marked: false });
    expect(segments.filter((segment) => segment.marked)).toEqual([
      { text: "legitymacja", marked: true },
    ]);
    expect(shown.length).toBeLessThanOrEqual(SNIPPET_LENGTH + 2);
    expect(shown.indexOf("legitymacja")).toBeGreaterThan(SNIPPET_LEAD - 15);
    expect(shown).not.toMatch(/…\S*\s$/u);
  });

  it("starts long text at the beginning when the match is near the start", ({ expect }) => {
    const text = `legitymacja ${"słowo ".repeat(60)}koniec`;
    const segments = snippet(text, "legitymacja");

    expect(segments[0]).toEqual({ text: "legitymacja", marked: true });
    expect(segments.at(-1)).toEqual({ text: "…", marked: false });
    expect(segments.map((segment) => segment.text).join("").length).toBeLessThanOrEqual(
      SNIPPET_LENGTH + 1,
    );
  });

  it("shows the start of long text without any match", ({ expect }) => {
    const text = "a".repeat(SNIPPET_LENGTH * 2);

    expect(snippet(text, "zebranie")).toEqual([
      { text: "a".repeat(SNIPPET_LENGTH), marked: false },
      { text: "…", marked: false },
    ]);
  });

  it("shows the end of long text when the match is near the end", ({ expect }) => {
    const text = `${"słowo ".repeat(60)}legitymacja`;
    const segments = snippet(text, "legitymacja");

    expect(segments[0]).toEqual({ text: "…", marked: false });
    expect(segments.at(-1)).toEqual({ text: "legitymacja", marked: true });
  });
});
