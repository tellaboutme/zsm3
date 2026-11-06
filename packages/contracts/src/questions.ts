import { z } from "zod";

export const questionAddressees = ["pedagogue", "psychologist", "leadership"] as const;
export const questionAddresseeSchema = z.enum(questionAddressees);
export type QuestionAddressee = z.infer<typeof questionAddresseeSchema>;

export const QUESTION_ADDRESSEE_LABELS: Readonly<Record<QuestionAddressee, string>> = {
  pedagogue: "Pedagog szkolny",
  psychologist: "Psycholog szkolny",
  leadership: "Dyrekcja szkoły",
};

export const questionStatuses = [
  "received",
  "draft",
  "published",
  "rejected",
  "withdrawn",
] as const;
export const questionStatusSchema = z.enum(questionStatuses);
export type QuestionStatus = z.infer<typeof questionStatusSchema>;

export const QUESTION_MIN_LENGTH = 10;
export const QUESTION_MAX_LENGTH = 1500;
export const ANSWER_MAX_LENGTH = 5000;
export const QUESTION_SLUG_LENGTH = 12;

const TAB = 0x09;
const LINE_FEED = 0x0a;
const FIRST_PRINTABLE = 0x20;
const DELETE = 0x7f;
const DIRECTION_CONTROLS: ReadonlySet<number> = new Set([
  0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
]);

function unsafeCodePoint(code: number): boolean {
  if (code === TAB || code === LINE_FEED) {
    return false;
  }
  return code < FIRST_PRINTABLE || code === DELETE || DIRECTION_CONTROLS.has(code);
}

export function normaliseText(value: string): string {
  return value.normalize("NFC").replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
}

export function hasUnsafeCharacters(value: string): boolean {
  for (const character of value) {
    if (unsafeCodePoint(character.charCodeAt(0))) {
      return true;
    }
  }
  return false;
}

function boundedText(min: number, max: number) {
  return z
    .string()
    .max(max * 2)
    .transform(normaliseText)
    .pipe(
      z
        .string()
        .min(min)
        .max(max)
        .refine((value) => !hasUnsafeCharacters(value), { message: "Unsafe characters" }),
    );
}

export const questionTextSchema = boundedText(QUESTION_MIN_LENGTH, QUESTION_MAX_LENGTH);
export const answerTextSchema = boundedText(0, ANSWER_MAX_LENGTH);
export const publishedAnswerSchema = boundedText(1, ANSWER_MAX_LENGTH);

export const questionInputSchema = z.strictObject({
  addressee: questionAddresseeSchema,
  question: questionTextSchema,
  rulesAccepted: z.literal(true),
  honeypot: z.literal(""),
  formKey: z.uuid(),
  turnstileToken: z.string().min(1).max(2048),
});
export type QuestionInput = z.infer<typeof questionInputSchema>;

export const questionSlugSchema = z
  .string()
  .length(QUESTION_SLUG_LENGTH)
  .regex(/^[a-z2-9]+$/u);

const isoDateSchema = z.iso.date();

export const publicQuestionSchema = z.strictObject({
  slug: questionSlugSchema,
  addressee: questionAddresseeSchema,
  question: z.string().min(1),
  answer: z.string().min(1),
  publishedOn: isoDateSchema,
});
export type PublicQuestion = z.infer<typeof publicQuestionSchema>;

export const questionDraftSchema = z.strictObject({
  question: questionTextSchema,
  answer: answerTextSchema,
});
export type QuestionDraft = z.infer<typeof questionDraftSchema>;

export const publishableDraftSchema = z.strictObject({
  question: questionTextSchema,
  answer: publishedAnswerSchema,
});

const versionSchema = z.number().int().min(1);

export const panelQuestionSummarySchema = z.strictObject({
  id: z.uuid(),
  addressee: questionAddresseeSchema,
  status: questionStatusSchema,
  version: versionSchema,
  receivedOn: isoDateSchema,
});
export type PanelQuestionSummary = z.infer<typeof panelQuestionSummarySchema>;

export const PANEL_QUESTIONS_PAGE = 20;

export const panelQuestionsQuerySchema = z
  .strictObject({
    status: questionStatusSchema.optional(),
    before: isoDateSchema.optional(),
    beforeId: z.uuid().optional(),
  })
  .refine((query) => (query.before === undefined) === (query.beforeId === undefined), {
    message: "Cursor fields must be provided together",
  });
export type PanelQuestionsQuery = z.infer<typeof panelQuestionsQuerySchema>;

export const panelQuestionsListSchema = z.strictObject({
  items: z.array(panelQuestionSummarySchema).max(PANEL_QUESTIONS_PAGE),
  nextBefore: isoDateSchema.nullable(),
  nextBeforeId: z.uuid().nullable(),
});
export type PanelQuestionsList = z.infer<typeof panelQuestionsListSchema>;

export const panelQuestionHistorySchema = z.strictObject({
  at: z.string(),
  action: z.string(),
  actorEmail: z.string().nullable(),
});

export const questionSealedParts = ["question", "draft"] as const;
export const questionSealedPartSchema = z.enum(questionSealedParts);
export type QuestionSealedPart = z.infer<typeof questionSealedPartSchema>;

export const panelQuestionDetailSchema = panelQuestionSummarySchema.extend({
  question: z.string().nullable(),
  unreadable: z.array(questionSealedPartSchema).max(questionSealedParts.length),
  draft: z.strictObject({ question: z.string(), answer: z.string() }).nullable(),
  published: z.strictObject({ slug: questionSlugSchema, publishedOn: isoDateSchema }).nullable(),
  history: z.array(panelQuestionHistorySchema),
});
export type PanelQuestionDetail = z.infer<typeof panelQuestionDetailSchema>;

export const panelQuestionDraftSaveSchema = questionDraftSchema.extend({
  expectedVersion: versionSchema,
});
export type PanelQuestionDraftSave = z.infer<typeof panelQuestionDraftSaveSchema>;

export const questionDecisions = ["publish", "reject", "withdraw", "delete"] as const;
export const questionDecisionSchema = z.enum(questionDecisions);
export type QuestionDecision = z.infer<typeof questionDecisionSchema>;

export const panelQuestionDecisionSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("publish"),
    expectedVersion: versionSchema,
    privacyReviewed: z.literal(true),
  }),
  z.strictObject({
    action: z.enum(["reject", "withdraw", "delete"]),
    expectedVersion: versionSchema,
  }),
]);
export type PanelQuestionDecision = z.infer<typeof panelQuestionDecisionSchema>;

export const panelQuestionWriteSchema = z.strictObject({
  ok: z.literal(true),
  version: versionSchema.nullable(),
});
export type PanelQuestionWrite = z.infer<typeof panelQuestionWriteSchema>;
