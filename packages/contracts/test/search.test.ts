import { describe, it } from "vitest";

import {
  resultTypeSchema,
  searchKindSchema,
  searchQuerySchema,
  searchResponseSchema,
  searchResultSchema,
  searchTextMaxLength,
} from "../src/search.ts";

describe("searchKindSchema", () => {
  it("accepts the indexed kinds only", ({ expect }) => {
    expect(searchKindSchema.parse("aktualnosc")).toBe("aktualnosc");
    expect(searchKindSchema.parse("strona")).toBe("strona");
    expect(searchKindSchema.safeParse("dokument").success).toBe(false);
  });
});

describe("resultTypeSchema", () => {
  it("accepts every result type and nothing else", ({ expect }) => {
    for (const type of [
      "strona",
      "kierunek",
      "klasa",
      "kontakt",
      "aktualnosc",
      "dokument",
      "termin",
    ] as const) {
      expect(resultTypeSchema.parse(type)).toBe(type);
    }
    expect(resultTypeSchema.safeParse("artykul").success).toBe(false);
  });
});

describe("searchQuerySchema", () => {
  it("trims and keeps queries between 2 and 200 characters", ({ expect }) => {
    expect(searchQuerySchema.parse("  legitymacja szkolna  ")).toBe("legitymacja szkolna");
    expect(searchQuerySchema.parse("ok")).toBe("ok");
    expect(searchQuerySchema.parse(`${" ".repeat(199)}ok`)).toBe("ok");
    expect(searchQuerySchema.safeParse(" x ").success).toBe(false);
    expect(searchQuerySchema.safeParse("x".repeat(201)).success).toBe(false);
    expect(searchQuerySchema.safeParse("").success).toBe(false);
    expect(searchQuerySchema.safeParse(undefined).success).toBe(false);
  });
});

describe("searchResultSchema", () => {
  const result = {
    type: "aktualnosc",
    title: "Salon Maturzystów",
    href: "/aktualnosci/2026/salon-maturzystow-2026",
    text: "Wykłady o egzaminie maturalnym.",
  } as const;

  it("accepts a valid result", ({ expect }) => {
    expect(searchResultSchema.parse(result)).toEqual(result);
  });

  it("rejects relative links, unknown types and oversized fields", ({ expect }) => {
    expect(searchResultSchema.safeParse({ ...result, href: "https://zsm3.pl" }).success).toBe(
      false,
    );
    expect(searchResultSchema.safeParse({ ...result, type: "inna" }).success).toBe(false);
    expect(searchResultSchema.safeParse({ ...result, title: "" }).success).toBe(false);
    expect(searchResultSchema.safeParse({ ...result, title: "x".repeat(201) }).success).toBe(false);
    expect(searchTextMaxLength).toBe(20000);
    expect(
      searchResultSchema.safeParse({ ...result, text: "x".repeat(searchTextMaxLength + 1) })
        .success,
    ).toBe(false);
    expect(
      searchResultSchema.safeParse({ ...result, text: "x".repeat(searchTextMaxLength) }).success,
    ).toBe(true);
  });
});

describe("searchResponseSchema", () => {
  const result = {
    type: "strona",
    title: "Kontakt",
    href: "/kontakt",
    text: "Sekretariat.",
  } as const;

  it("accepts results with an optional suggestion", ({ expect }) => {
    expect(searchResponseSchema.parse({ results: [result] })).toEqual({ results: [result] });
    expect(searchResponseSchema.parse({ results: [result], suggestion: "legitymacja" })).toEqual({
      results: [result],
      suggestion: "legitymacja",
    });
  });

  it("caps the merged results at fifty", ({ expect }) => {
    const results = [...Array.from({ length: 51 }).keys()].map((index) => ({
      ...result,
      title: `Strona ${String(index)}`,
      href: `/strona-${String(index)}`,
    }));
    expect(searchResponseSchema.safeParse({ results: results.slice(0, 50) }).success).toBe(true);
    expect(searchResponseSchema.safeParse({ results }).success).toBe(false);
  });
});
