import { describe, it } from "vitest";

import { META_DESCRIPTION_LIMIT, metaDescription } from "../src/lib/seo.ts";

const word = (count: number): string => Array.from({ length: count }, () => "słowo").join(" ");

describe("meta description", () => {
  it("keeps a short description and tidies its spacing", ({ expect }) => {
    expect(metaDescription("  Szkoła   w Nowej\nHucie. ")).toBe("Szkoła w Nowej Hucie.");
  });

  it("keeps a description of exactly the limit", ({ expect }) => {
    const text = "a".repeat(META_DESCRIPTION_LIMIT);
    expect(metaDescription(text)).toBe(text);
  });

  it("cuts a long description at a word boundary and marks the cut", ({ expect }) => {
    const text = word(40);
    const summary = metaDescription(text);
    expect(summary.length).toBeLessThanOrEqual(META_DESCRIPTION_LIMIT);
    expect(summary.endsWith(" słowo…")).toBe(true);
    expect(text.startsWith(summary.slice(0, -1))).toBe(true);
  });

  it("drops punctuation left before the cut", ({ expect }) => {
    const text = `${"x".repeat(148)} –, ${"y".repeat(20)}`;
    expect(metaDescription(text)).toBe(`${"x".repeat(148)}…`);
  });

  it("cuts a single overlong word at the limit", ({ expect }) => {
    const summary = metaDescription("z".repeat(200));
    expect(summary).toBe(`${"z".repeat(META_DESCRIPTION_LIMIT - 1)}…`);
  });

  it("uses a limit that search results show in full", ({ expect }) => {
    expect(META_DESCRIPTION_LIMIT).toBe(160);
  });
});
