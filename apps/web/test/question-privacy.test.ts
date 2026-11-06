import type { PanelQuestionDetail } from "@zsm3/contracts/questions";
import { describe, it } from "vitest";

import {
  PRIVACY_HINTS_NONE,
  PRIVACY_REVIEW_LABEL,
  PRIVACY_REVIEW_MISSING,
  privacyHints,
} from "../src/lib/panel/question-privacy.ts";
import { canEditDraft, decisionActions, originalNotice } from "../src/lib/panel/questions.ts";

const BROKEN: PanelQuestionDetail = {
  id: "0191e4a0-0000-4000-8000-000000000000",
  addressee: "pedagogue",
  status: "draft",
  version: 2,
  receivedOn: "2026-10-20",
  question: null,
  unreadable: ["question"],
  draft: { question: "Szkic", answer: "Tak" },
  published: null,
  history: [],
};

describe("privacy hints before publication", () => {
  it("warns about digits, contact details, names and people", ({ expect }) => {
    const hints = privacyHints(
      "Mam problem z Ewą z klasy 2B.",
      "Napisz na uczen@example.com albo zapytaj wychowawczynię.",
    );

    expect(hints).toHaveLength(4);
    expect(hints[0]).toContain("cyfry");
    expect(hints[1]).toContain("e-mail");
    expect(hints[2]).toContain("wielką literą");
    expect(hints[3]).toContain("konkretne osoby");
  });

  it("stays silent for a neutral question and an answer at sentence starts", ({ expect }) => {
    expect(privacyHints("Jak radzić sobie ze stresem? Czy to normalne.", "Tak. Spróbuj")).toEqual(
      [],
    );
    expect(privacyHints("Zobacz www.example.test")).toHaveLength(1);
    expect(privacyHints("Link https://example.test")).toHaveLength(1);
  });

  it("explains that the check only warns", ({ expect }) => {
    expect(PRIVACY_HINTS_NONE).toContain("nie zastąpi Twojej oceny");
    expect(PRIVACY_REVIEW_LABEL).toContain("oznaczeń klas, danych kontaktowych");
    expect(PRIVACY_REVIEW_MISSING).toContain("zaznacz potwierdzenie");
  });
});

describe("an unreadable question in the panel", () => {
  it("stays stored but cannot be edited or published", ({ expect }) => {
    expect(decisionActions(BROKEN).map((spec) => spec.action)).toEqual(["reject", "delete"]);
    expect(canEditDraft(BROKEN)).toBe(false);
    expect(canEditDraft({ ...BROKEN, status: "received", unreadable: ["draft"] })).toBe(false);
    expect(originalNotice(BROKEN)).toContain("Zapis jest zachowany");
    expect(originalNotice(BROKEN)).toContain("klucza szyfrowania");
  });
});
