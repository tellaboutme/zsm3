import { describe, it } from "vitest";

import {
  ANSWER_MAX_LENGTH,
  hasUnsafeCharacters,
  normaliseText,
  panelQuestionDecisionSchema,
  panelQuestionDetailSchema,
  panelQuestionDraftSaveSchema,
  panelQuestionsListSchema,
  panelQuestionsQuerySchema,
  panelQuestionWriteSchema,
  publishableDraftSchema,
  publicQuestionSchema,
  QUESTION_ADDRESSEE_LABELS,
  QUESTION_MAX_LENGTH,
  QUESTION_MIN_LENGTH,
  questionDraftSchema,
  questionInputSchema,
  questionSlugSchema,
} from "../src/questions.ts";

const FORM_KEY = "5f0c4c56-3c1b-4c55-9d36-3a5e7f0a9b11";

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    addressee: "psychologist",
    question: "Jak poradzić sobie ze stresem przed sprawdzianem?",
    rulesAccepted: true,
    honeypot: "",
    formKey: FORM_KEY,
    submittedAtMs: 1_800_000_000_000,
    turnstileToken: "token",
    ...overrides,
  };
}

describe("question text", () => {
  it("normalises line endings, composition and outer whitespace", ({ expect }) => {
    expect(normaliseText("  Cześc\r\nlinia\rdruga  ")).toBe("Cześc\nlinia\ndruga");
  });

  it("flags control and direction characters but keeps tabs, new lines and emoji", ({ expect }) => {
    expect(hasUnsafeCharacters("a\tb\nc 🙂")).toBe(false);
    expect(hasUnsafeCharacters("a\u0000b")).toBe(true);
    expect(hasUnsafeCharacters("a\u001fb")).toBe(true);
    expect(hasUnsafeCharacters("a\u007fb")).toBe(true);
    expect(hasUnsafeCharacters("a‮b")).toBe(true);
    expect(hasUnsafeCharacters("a⁦b")).toBe(true);
    expect(hasUnsafeCharacters("a‏b")).toBe(true);
    expect(hasUnsafeCharacters(" ")).toBe(false);
  });
});

describe("anonymous question input", () => {
  it("accepts a complete submission and trims the text", ({ expect }) => {
    const parsed = questionInputSchema.parse(input({ question: "  Pytanie o stres.  " }));
    expect(parsed.question).toBe("Pytanie o stres.");
    expect(Object.keys(QUESTION_ADDRESSEE_LABELS)).toEqual([
      "pedagogue",
      "psychologist",
      "leadership",
    ]);
  });

  it("enforces the length bounds after trimming", ({ expect }) => {
    const ok = (question: string) => questionInputSchema.safeParse(input({ question })).success;
    expect(ok("a".repeat(QUESTION_MIN_LENGTH))).toBe(true);
    expect(ok("a".repeat(QUESTION_MIN_LENGTH - 1))).toBe(false);
    expect(ok(`   ${"a".repeat(QUESTION_MIN_LENGTH - 1)}   `)).toBe(false);
    expect(ok("a".repeat(QUESTION_MAX_LENGTH))).toBe(true);
    expect(ok("a".repeat(QUESTION_MAX_LENGTH + 1))).toBe(false);
    expect(ok(" ".repeat(QUESTION_MAX_LENGTH * 2 + 1))).toBe(false);
  });

  it("refuses identifying or unexpected fields and broken flags", ({ expect }) => {
    const refused = [
      input({ email: "uczen@example.com" }),
      input({ name: "Jan" }),
      input({ honeypot: "x" }),
      input({ rulesAccepted: false }),
      input({ addressee: "teacher" }),
      input({ formKey: "abc" }),
      input({ turnstileToken: "" }),
      input({ turnstileToken: "t".repeat(2049) }),
      input({ submittedAtMs: -1 }),
      input({ question: "Pytanie‮ z ukrytym kierunkiem" }),
    ];
    expect(refused.map((value) => questionInputSchema.safeParse(value).success)).toEqual(
      refused.map(() => false),
    );
  });
});

describe("moderation payloads", () => {
  it("allows an empty draft answer but not an empty published one", ({ expect }) => {
    const draft = { question: "Pytanie do publikacji.", answer: "" };
    expect(questionDraftSchema.parse(draft)).toEqual(draft);
    expect(publishableDraftSchema.safeParse(draft).success).toBe(false);
    expect(publishableDraftSchema.safeParse({ ...draft, answer: " Odpowiedź " }).data).toEqual({
      question: "Pytanie do publikacji.",
      answer: "Odpowiedź",
    });
    expect(publishableDraftSchema.safeParse(null).success).toBe(false);
    expect(
      questionDraftSchema.safeParse({ ...draft, answer: "a".repeat(ANSWER_MAX_LENGTH + 1) })
        .success,
    ).toBe(false);
  });

  it("requires a positive integer version on every write", ({ expect }) => {
    const save = { question: "Pytanie do publikacji.", answer: "Tak." };
    expect(panelQuestionDraftSaveSchema.safeParse({ ...save, expectedVersion: 1 }).success).toBe(
      true,
    );
    expect(panelQuestionDraftSaveSchema.safeParse({ ...save, expectedVersion: 0 }).success).toBe(
      false,
    );
    expect(panelQuestionDraftSaveSchema.safeParse(save).success).toBe(false);
    expect(
      panelQuestionDecisionSchema.safeParse({ action: "publish", expectedVersion: 2 }).success,
    ).toBe(true);
    expect(
      panelQuestionDecisionSchema.safeParse({ action: "approve", expectedVersion: 2 }).success,
    ).toBe(false);
  });

  it("takes the list cursor only as a pair", ({ expect }) => {
    const id = "0191e4a0-0000-4000-8000-000000000000";
    expect(panelQuestionsQuerySchema.safeParse({}).success).toBe(true);
    expect(panelQuestionsQuerySchema.safeParse({ status: "draft" }).success).toBe(true);
    expect(
      panelQuestionsQuerySchema.safeParse({ before: "2026-10-20", beforeId: id }).success,
    ).toBe(true);
    expect(panelQuestionsQuerySchema.safeParse({ before: "2026-10-20" }).success).toBe(false);
    expect(panelQuestionsQuerySchema.safeParse({ beforeId: id }).success).toBe(false);
    expect(panelQuestionsQuerySchema.safeParse({ status: "new" }).success).toBe(false);
  });
});

describe("public shapes", () => {
  it("accept only well-formed slugs and published entries", ({ expect }) => {
    expect(questionSlugSchema.safeParse("abcdefgh2345").success).toBe(true);
    expect(questionSlugSchema.safeParse("abcdefgh234").success).toBe(false);
    expect(questionSlugSchema.safeParse("ABCDEFGH2345").success).toBe(false);
    expect(questionSlugSchema.safeParse("abcdefgh1234").success).toBe(false);
    const entry = {
      slug: "abcdefgh2345",
      addressee: "leadership",
      question: "Pytanie?",
      answer: "Odpowiedź.",
      publishedOn: "2026-10-22",
    };
    expect(publicQuestionSchema.parse(entry)).toEqual(entry);
    expect(publicQuestionSchema.safeParse({ ...entry, answer: "" }).success).toBe(false);
    expect(
      panelQuestionDetailSchema.safeParse({
        id: "0191e4a0-0000-4000-8000-000000000000",
        addressee: "pedagogue",
        status: "published",
        version: 3,
        receivedOn: "2026-10-20",
        question: null,
        draft: { question: "Pytanie?", answer: "Odpowiedź." },
        published: { slug: "abcdefgh2345", publishedOn: "2026-10-22" },
        history: [{ at: "2026-10-22T08:00:00Z", action: "questions.publish", actorEmail: null }],
      }).success,
    ).toBe(true);
  });
});

describe("labels and messages", () => {
  it("names each addressee in Polish", ({ expect }) => {
    expect(QUESTION_ADDRESSEE_LABELS).toEqual({
      pedagogue: "Pedagog szkolny",
      psychologist: "Psycholog szkolny",
      leadership: "Dyrekcja szkoły",
    });
  });

  it("explains why text or a cursor was refused", ({ expect }) => {
    const text = questionInputSchema.safeParse(input({ question: "Pytanie z ‮odwróceniem" }));
    const cursor = panelQuestionsQuerySchema.safeParse({ before: "2026-10-20" });
    expect(text.error?.issues.map((issue) => issue.message)).toEqual(["Unsafe characters"]);
    expect(cursor.error?.issues.map((issue) => issue.message)).toEqual([
      "Cursor fields must be provided together",
    ]);
  });
});

describe("panel responses", () => {
  it("bounds a list page and requires a successful write", ({ expect }) => {
    const item = {
      id: "0191e4a0-0000-4000-8000-000000000000",
      addressee: "pedagogue",
      status: "received",
      version: 1,
      receivedOn: "2026-10-20",
    };
    const page = (count: number) => ({
      items: Array.from({ length: count }, () => item),
      nextBefore: null,
      nextBeforeId: null,
    });
    expect(panelQuestionsListSchema.safeParse(page(0)).success).toBe(true);
    expect(panelQuestionsListSchema.safeParse(page(20)).success).toBe(true);
    expect(panelQuestionsListSchema.safeParse(page(21)).success).toBe(false);
    expect(panelQuestionWriteSchema.parse({ ok: true, version: 2 })).toEqual({
      ok: true,
      version: 2,
    });
    expect(panelQuestionWriteSchema.parse({ ok: true, version: null }).version).toBeNull();
    expect(panelQuestionWriteSchema.safeParse({ ok: false, version: 2 }).success).toBe(false);
  });
});
