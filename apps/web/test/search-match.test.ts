import { describe, it } from "vitest";

import {
  bestMatch,
  directMatch,
  editDistance,
  MATCH_EXACT,
  MATCH_PREFIX,
  MATCH_STEM,
  MATCH_SYNONYM,
  MATCH_TYPO,
  matchToken,
  MIN_SHARED_ROOT,
  PREFIX_TYPO_LENGTH,
  PREFIX_TYPOS,
  ROOT_SLACK,
  sharesRoot,
  synonymsOf,
  termMatch,
  typoAllowance,
} from "../src/lib/search-match.ts";

describe("edit distance", () => {
  it("counts insertions, deletions, substitutions and swaps", ({ expect }) => {
    expect(editDistance("", "")).toBe(0);
    expect(editDistance("abc", "")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("dzwonki", "dzwonki")).toBe(0);
    expect(editDistance("dzwonki", "dzownki")).toBe(1);
    expect(editDistance("ab", "ba")).toBe(1);
    expect(editDistance("abc", "bca")).toBe(2);
    expect(editDistance("informtyk", "informatyk")).toBe(1);
    expect(editDistance("kot", "pies")).toBe(4);
    expect(editDistance("abcd", "acbd")).toBe(1);
    expect(editDistance("sala", "sale")).toBe(1);
    expect(editDistance("ba", "cb")).toBe(2);
    expect(editDistance("ba", "ac")).toBe(2);
  });

  it("allows more typos in longer words", ({ expect }) => {
    expect([3, 4, 7, 8].map((length) => typoAllowance("x".repeat(length)))).toEqual([0, 1, 1, 2]);
    expect(typoAllowance("12345678")).toBe(0);
    expect(typoAllowance("sala204")).toBe(0);
    expect(matchToken("1205", "120")).toBe(0);
    expect(PREFIX_TYPOS).toBe(1);
    expect(PREFIX_TYPO_LENGTH).toBe(5);
  });
});

describe("matching a term to a word", () => {
  it("scores exact, stem, prefix and typo matches in that order", ({ expect }) => {
    expect([MATCH_EXACT, MATCH_STEM, MATCH_PREFIX, MATCH_SYNONYM, MATCH_TYPO]).toEqual([
      1, 0.9, 0.8, 0.7, 0.5,
    ]);
    expect(matchToken("dzwonki", "dzwonki")).toBe(MATCH_EXACT);
    expect(matchToken("dzwonki", "dzwonek")).toBe(MATCH_STEM);
    expect(matchToken("inform", "informatyk")).toBe(MATCH_PREFIX);
    expect(matchToken("dzownki", "dzwonki")).toBe(MATCH_TYPO);
    expect(matchToken("informtyk", "informatyk")).toBe(MATCH_TYPO);
    expect(matchToken("informtyk", "informatykiem")).toBe(0);
    expect(matchToken("lotniczy", "lotnicze")).toBe(MATCH_STEM);
    expect(matchToken("kot", "kat")).toBe(0);
    expect(matchToken("sala", "salon")).toBe(0);
  });

  it("treats words with a shared root of five letters as one word", ({ expect }) => {
    expect(MIN_SHARED_ROOT).toBe(5);
    expect(sharesRoot("lotniczy", "lotniczego")).toBe(true);
    expect(sharesRoot("lotniczego", "lotniczy")).toBe(true);
    expect(sharesRoot("dzwonki", "dzwonek")).toBe(true);
    expect(sharesRoot("lotniczego", "lotniczemu")).toBe(true);
    expect(sharesRoot("kota", "kotami")).toBe(false);
    expect(sharesRoot("lotniczy", "lotnisko")).toBe(false);
    expect(sharesRoot("informtyk", "informacji")).toBe(false);
    expect(ROOT_SLACK).toBe(2);
    expect(matchToken("lotniczego", "lotniczy")).toBe(MATCH_STEM);
  });

  it("can turn typo matching off", ({ expect }) => {
    expect(matchToken("dzownki", "dzwonki", false)).toBe(0);
    expect(matchToken("dzwonki", "dzwonki", false)).toBe(MATCH_EXACT);
    expect(directMatch("dzownki", "dzwonki")).toBe(0);
    expect(directMatch("dzw", "dzwonki")).toBe(MATCH_PREFIX);
  });

  it("ignores words of very different length", ({ expect }) => {
    expect(matchToken("abcd", "abcdxyzw")).toBe(MATCH_PREFIX);
    expect(matchToken("abcx", "abcdxyzwq")).toBe(0);
    expect(matchToken("abxd", "abcdxyz")).toBe(0);
    expect(matchToken("abxde", "abcdexy")).toBe(MATCH_TYPO);
    expect(matchToken("abcdefgh", "abcdefgxyz")).toBe(MATCH_STEM);
    expect(matchToken("abcdefgh", "abcdxfghij")).toBe(MATCH_TYPO);
  });

  it("does not stretch the prefix comparison past one typo", ({ expect }) => {
    expect(matchToken("informtyk", "informacji")).toBe(0);
    expect(matchToken("informtyk", "informatyka")).toBe(MATCH_TYPO);
    expect(matchToken("dzownk", "dzwonkiem")).toBe(MATCH_TYPO);
    expect(matchToken("dzwn", "dzwonkiem")).toBe(0);
    expect(matchToken("dzown", "dzwonkiem")).toBe(MATCH_TYPO);
  });
});

describe("matching a term to a field", () => {
  it("keeps the best word", ({ expect }) => {
    expect(bestMatch("dzwonki", [])).toBe(0);
    expect(bestMatch("dzwonki", ["plan", "dzwonek", "dzwonki"])).toBe(MATCH_EXACT);
    expect(bestMatch("dzownki", ["dzwonki"], false)).toBe(0);
    expect(bestMatch("dzownki", ["dzwonki"])).toBe(MATCH_TYPO);
    expect(termMatch("dzownki", ["dzwonki"])).toBe(MATCH_TYPO);
    expect(termMatch("dzownki", ["dzwonki"], false)).toBe(0);
  });

  it("finds words through synonyms with a lower score", ({ expect }) => {
    expect(synonymsOf("samolot")).toEqual(["lotnictwo", "lotniczy", "awionik", "lotnisko"]);
    expect(synonymsOf("wf")).toEqual(["wychowanie"]);
    expect(synonymsOf("kot")).toEqual([]);
    expect(termMatch("samolot", ["lotniczy"])).toBe(MATCH_SYNONYM);
    expect(termMatch("samolot", ["lotniczego"])).toBe(MATCH_SYNONYM);
    expect(termMatch("samolot", ["samolot", "lotniczy"])).toBe(MATCH_EXACT);
    expect(termMatch("samolo", ["samolot", "lotniczy"])).toBe(MATCH_PREFIX);
    expect(termMatch("samolot", ["lotniczych"], false)).toBe(MATCH_SYNONYM);
    expect(termMatch("samolot", ["lotnyczy"])).toBe(0);
    expect(termMatch("kot", ["pies"])).toBe(0);
  });
});
