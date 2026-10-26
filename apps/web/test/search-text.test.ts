import { describe, it } from "vitest";

import {
  classCodes,
  MIN_TERM_LENGTH,
  qualificationCodes,
  queryTerms,
  stem,
  tokens,
  words,
} from "../src/lib/search-text.ts";

describe("search text", () => {
  it("cuts common endings from longer words and remembers them", ({ expect }) => {
    expect(stem("abcd")).toBe("abcd");
    expect(stem("dzwon")).toBe("dzwo");
    expect(stem("dzwonki")).toBe("dzwon");
    expect(stem("legitymacja")).toBe("legityma");
    expect(stem("legitymacja")).toBe("legityma");
  });

  it("reads class codes with and without spaces, including shared classes", ({ expect }) => {
    expect(classCodes("Klasy 4 Tb, 4Td i 3 Ta/d")).toEqual(["4tb", "4td", "3ta", "3td"]);
    expect(classCodes("1 LST, 2 Tm/s, 1 Bb/d")).toEqual(["1lst", "2tm", "2ts", "1bb", "1bd"]);
    expect(classCodes("2 Tab/c i 1 Ta/b/c")).toEqual(["2tab", "2tac", "1ta", "1tb", "1tc"]);
    expect(classCodes("2026 roku, 5 lekcji, 10 tb, 4 tbcd, x4tb")).toEqual([]);
  });

  it("reads qualification codes with or without a dot", ({ expect }) => {
    expect(qualificationCodes("INF.03, INF 04 i MEC08")).toEqual(["inf03", "inf04", "mec08"]);
    expect(qualificationCodes("sala 204, ABCDE.01, X.01")).toEqual([]);
  });

  it("splits text into unique words and codes", ({ expect }) => {
    expect(words("")).toEqual([]);
    expect(words("Sala 4 Tp")).toEqual(["sala", "4", "tp"]);
    expect(tokens("Sala 4 Tp, sala INF.03")).toEqual([
      "sala",
      "4",
      "tp",
      "inf",
      "03",
      "4tp",
      "inf03",
    ]);
  });

  it("joins codes in a query and drops one-letter words", ({ expect }) => {
    expect(MIN_TERM_LENGTH).toBe(2);
    expect(queryTerms("x")).toEqual([]);
    expect(queryTerms("it")).toEqual(["it"]);
    expect(queryTerms("4TP")).toEqual(["4tp"]);
    expect(queryTerms("klasa 4 Tp")).toEqual(["klasa", "4tp"]);
    expect(queryTerms("3 Ta/d")).toEqual(["3ta"]);
    expect(queryTerms("INF.03 inf 03")).toEqual(["inf03"]);
    expect(queryTerms("Legitymacja szkolna a")).toEqual(["legitymacja", "szkolna"]);
  });
});
