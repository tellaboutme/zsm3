import { describe, it } from "vitest";

import {
  ADDRESSEE_OPTIONS,
  HELP_LINES,
  QUESTIONS_PAGE_SIZE,
  addresseeLabel,
  boxAvailability,
  excerpt,
  fieldError,
  lengthHint,
  pageCount,
  pageNumber,
  paragraphs,
  questionRefusal,
  questionsPageHref,
} from "../src/lib/questions.ts";

describe("Skrzynka availability", () => {
  it("opens only when switched on with a site key", ({ expect }) => {
    expect(boxAvailability("true", "0x4AAA")).toEqual({ open: true, siteKey: "0x4AAA" });
    expect(boxAvailability(" true ", " 0x4AAA ")).toEqual({ open: true, siteKey: "0x4AAA" });
    expect(boxAvailability("true", " ")).toEqual({ open: false, siteKey: "" });
    expect(boxAvailability("true", undefined)).toEqual({ open: false, siteKey: "" });
    expect(boxAvailability("TRUE", "k").open).toBe(false);
    expect(boxAvailability("1", "k").open).toBe(false);
    expect(boxAvailability(undefined, "k").open).toBe(false);
  });
});

describe("help and labels", () => {
  it("always lists the child helpline and the emergency number", ({ expect }) => {
    expect(HELP_LINES).toEqual([
      {
        name: "Telefon zaufania dla dzieci i młodzieży",
        number: "116 111",
        href: "tel:116111",
        when: "bezpłatnie, przez całą dobę",
      },
      {
        name: "Numer alarmowy",
        number: "112",
        href: "tel:112",
        when: "gdy zagrożone jest czyjeś życie lub zdrowie",
      },
    ]);
    expect(ADDRESSEE_OPTIONS).toEqual([
      { value: "pedagogue", label: "Pedagog szkolny" },
      { value: "psychologist", label: "Psycholog szkolny" },
      { value: "leadership", label: "Dyrekcja szkoły" },
    ]);
    expect(addresseeLabel("leadership")).toBe("Dyrekcja szkoły");
  });
});

describe("answer text", () => {
  it("splits paragraphs on blank lines and keeps single line breaks", ({ expect }) => {
    expect(paragraphs("Pierwszy\n akapit\n\n\n  \nDrugi  \n\n")).toEqual([
      ["Pierwszy", "akapit"],
      ["Drugi"],
    ]);
    expect(paragraphs("<b>znaczniki</b> zostają tekstem")).toEqual([
      ["<b>znaczniki</b> zostają tekstem"],
    ]);
    expect(paragraphs("\n \n")).toEqual([]);
  });

  it("shortens long text on a word-safe boundary", ({ expect }) => {
    expect(excerpt("  Krótki\n tekst ")).toBe("Krótki tekst");
    expect(excerpt("a".repeat(160))).toBe("a".repeat(160));
    expect(excerpt(`${"a".repeat(158)} bcd`)).toBe(`${"a".repeat(158)}…`);
    expect(excerpt("abcdef", 4)).toBe("abc…");
  });
});

describe("pagination", () => {
  it("builds page addresses and counts", ({ expect }) => {
    expect([questionsPageHref(0), questionsPageHref(1), questionsPageHref(3)]).toEqual([
      "/skrzynka",
      "/skrzynka",
      "/skrzynka/strona/3",
    ]);
    expect([
      pageCount(0),
      pageCount(QUESTIONS_PAGE_SIZE),
      pageCount(QUESTIONS_PAGE_SIZE + 1),
    ]).toEqual([1, 1, 2]);
  });

  it("accepts only canonical page numbers above one", ({ expect }) => {
    expect(["2", "9999", "1", "0", "02", "10000", "x", "-2", undefined].map(pageNumber)).toEqual([
      2,
      9999,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe("form messages", () => {
  it("explains each refusal in Polish without blaming the student", ({ expect }) => {
    expect(questionRefusal(429)).toContain("zbyt wiele pytań");
    expect(questionRefusal(403)).toContain("Weryfikacja");
    expect(questionRefusal(404)).toBe(questionRefusal(503));
    expect(questionRefusal(400)).toContain("Sprawdź jego treść");
    expect(questionRefusal(413)).toContain("za długie");
    expect(questionRefusal(415)).toContain("Odśwież stronę");
    expect(questionRefusal(0)).toContain("połączenie z internetem");
    expect(questionRefusal(500)).toBe(questionRefusal(0));
  });

  it("names the field to fix", ({ expect }) => {
    expect(fieldError("addressee")).toBe("Wybierz, kto Twoim zdaniem najlepiej odpowie.");
    expect(fieldError("question")).toContain("od 10 do 1500 znaków");
    expect(fieldError("rulesAccepted")).toContain("zasady");
    expect(fieldError("turnstileToken")).toContain("weryfikacji");
    expect(fieldError("formKey")).toBe("Sprawdź pytanie.");
    expect(fieldError(undefined)).toBe("Sprawdź pytanie.");
    expect(lengthHint(42)).toBe("42 z 1500 znaków");
  });
});
