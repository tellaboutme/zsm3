import { z } from "zod";

export const requestTypes = [
  "STUDENT_ID_RENEWAL",
  "STUDENT_ID_DUPLICATE",
  "ENROLLMENT_CERTIFICATE",
] as const;

export const requestTypeSchema = z.enum(requestTypes);

export type RequestType = z.infer<typeof requestTypeSchema>;

export const requestStatuses = [
  "submitted",
  "in_progress",
  "ready",
  "collected",
  "rejected",
  "withdrawn",
] as const;

export const requestStatusSchema = z.enum(requestStatuses);

export type RequestStatus = z.infer<typeof requestStatusSchema>;

export const emailKinds = [
  "SUBMISSION_CONFIRMATION",
  "SECRETARIAT_NOTICE",
  "READY_NOTICE",
  "REJECTED_NOTICE",
] as const;

export const emailKindSchema = z.enum(emailKinds);

export type EmailKind = z.infer<typeof emailKindSchema>;

export const schoolClasses = [
  "1ba",
  "1bb",
  "1bd",
  "1lst",
  "1ta",
  "1tb",
  "1tc",
  "1td",
  "1tp",
  "1ts",
  "2ba",
  "2ta",
  "2tb",
  "2tc",
  "2td",
  "2tm",
  "2tp",
  "2ts",
  "3ba",
  "3bb",
  "3bd",
  "3ta",
  "3td",
  "3tb",
  "3tm",
  "3tp",
  "3ts",
  "4ta",
  "4tb",
  "4tc",
  "4td",
  "4tm",
  "4tp",
  "4ts",
  "5ta",
  "5tb",
  "5tc",
  "5td",
  "5te",
  "5tm",
  "5tp",
  "5ts",
] as const;

export type SchoolClass = (typeof schoolClasses)[number];

export const MIN_GRADUATION_YEAR = 1990;
export const MAX_GRADUATION_YEAR = 2100;

export const graduationYearSchema = z
  .number()
  .int()
  .min(MIN_GRADUATION_YEAR)
  .max(MAX_GRADUATION_YEAR);

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const noteSchema = z
  .string()
  .transform((value) => value.normalize("NFC").trim())
  .pipe(z.string().max(500))
  .transform((value) => (value.length === 0 ? undefined : value));

export const tokenSchema = z.string().regex(/^[\w-]{43}$/u);

const personalNameSchema = z
  .string()
  .transform((value) => value.normalize("NFC").trim())
  .pipe(z.string().min(1).max(100));

const classNameSchema = z
  .string()
  .transform((value) => value.replaceAll(" ", "").toLowerCase())
  .pipe(z.enum(schoolClasses));

const submissionBase = {
  firstName: personalNameSchema,
  lastName: personalNameSchema,
  email: emailSchema,
  note: noteSchema.optional(),
  turnstileToken: z.string().min(1).max(2048),
  noticesAccepted: z.literal(true),
  honeypot: z.literal(""),
  formKey: z.uuid({ version: "v4" }),
  submittedAtMs: z.number().int().min(0),
};

const studentIdRequestSchema = z.strictObject({
  type: z.literal("STUDENT_ID_RENEWAL"),
  ...submissionBase,
  className: classNameSchema,
});

const studentIdDuplicateSchema = z.strictObject({
  type: z.literal("STUDENT_ID_DUPLICATE"),
  ...submissionBase,
  className: classNameSchema,
});

const enrollmentCertificateSchema = z
  .strictObject({
    type: z.literal("ENROLLMENT_CERTIFICATE"),
    ...submissionBase,
    className: classNameSchema.optional(),
    graduationYear: graduationYearSchema.optional(),
  })
  .refine((request) => request.className !== undefined || request.graduationYear !== undefined, {
    message: "The class name or the graduation year is required",
    path: ["className"],
  });

export const requestInputSchema = z.discriminatedUnion("type", [
  studentIdRequestSchema,
  studentIdDuplicateSchema,
  enrollmentCertificateSchema,
]);

export type RequestInput = z.infer<typeof requestInputSchema>;

export const requestPiiSchema = z.strictObject({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  className: z.string().min(1).optional(),
  graduationYear: z.number().int().optional(),
  email: z.email(),
  note: z.string().max(500).optional(),
  statusToken: tokenSchema,
});

export type RequestPii = z.infer<typeof requestPiiSchema>;

export const statusResponseSchema = z.strictObject({
  type: requestTypeSchema,
  status: requestStatusSchema,
  updatedAt: z.iso.datetime(),
  collectionMessage: z.string(),
});

export type StatusResponse = z.infer<typeof statusResponseSchema>;

export const submissionResponseSchema = z.strictObject({
  statusUrl: z.string().min(1),
});

export type SubmissionResponse = z.infer<typeof submissionResponseSchema>;

export const panelRequestSummarySchema = z.strictObject({
  id: z.uuid(),
  type: requestTypeSchema,
  status: requestStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type PanelRequestSummary = z.infer<typeof panelRequestSummarySchema>;

export const panelRequestDetailSchema = panelRequestSummarySchema.extend({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  className: z.string().min(1).nullable(),
  graduationYear: z.number().int().nullable(),
  email: z.email(),
  note: z.string().max(500).nullable(),
  piiErasedAt: z.iso.datetime().nullable(),
});

export type PanelRequestDetail = z.infer<typeof panelRequestDetailSchema>;

export const documentTypeLabels: Readonly<Record<RequestType, string>> = {
  STUDENT_ID_RENEWAL: "Wymiana legitymacji szkolnej",
  STUDENT_ID_DUPLICATE: "Duplikat legitymacji szkolnej",
  ENROLLMENT_CERTIFICATE: "Zaświadczenie o uczęszczaniu do szkoły",
};

export interface RequestTypeInfo {
  readonly label: string;
  readonly description: string;
}

export const requestTypeMeta: Readonly<Record<RequestType, RequestTypeInfo>> = {
  STUDENT_ID_RENEWAL: {
    label: "Wymiana legitymacji szkolnej",
    description:
      "Wniosek o wymianę legitymacji szkolnej, np. przy zmianie klasy albo w razie uszkodzenia.",
  },
  STUDENT_ID_DUPLICATE: {
    label: "Duplikat legitymacji szkolnej",
    description: "Wniosek o wydanie duplikatu legitymacji szkolnej w przypadku jej zagubienia.",
  },
  ENROLLMENT_CERTIFICATE: {
    label: "Zaświadczenie o uczęszczaniu do szkoły",
    description:
      "Zaświadczenie o uczęszczaniu do szkoły dla ucznia lub absolventa. Wydaje je sekretariat.",
  },
};
