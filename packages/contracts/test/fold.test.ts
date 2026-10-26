import { describe, it } from "vitest";

import { fold, foldMarks } from "../src/fold.ts";

describe("foldMarks", () => {
  it("folds Polish letters, case and diacritics", ({ expect }) => {
    expect(foldMarks("Łódź 3 Ta/d")).toBe("lodz 3 ta/d");
    expect(foldMarks("Zażółć GĘŚLĄ")).toBe("zazolc gesla");
  });
});

describe("fold", () => {
  it("keeps only folded letters and digits", ({ expect }) => {
    expect(fold("  Zażółć GĘŚLĄ, jaźń!  ")).toBe("zazolc gesla jazn");
    expect(fold("Łódź-2026")).toBe("lodz 2026");
    expect(fold("!@#")).toBe("");
  });
});
