import { describe, it } from "vitest";

import {
  emailKindSchema,
  emailSchema,
  graduationYearSchema,
  MAX_GRADUATION_YEAR,
  MIN_GRADUATION_YEAR,
  noteSchema,
  requestInputSchema,
  requestStatusSchema,
  requestTypeSchema,
  tokenSchema,
} from "../src/requests.ts";

const TOKEN = "a".repeat(43);

const baseInput = {
  firstName: "  Jan  ",
  lastName: "Przykładowy",
  email: "  Jan.Przykladowy@Example.COM ",
  turnstileToken: "token",
  noticesAccepted: true,
  honeypot: "",
  formKey: "11111111-2222-4333-8444-555555555555",
  submittedAtMs: 1_000,
};

describe("request enums", () => {
  it("accepts known request types and rejects unknown ones", ({ expect }) => {
    expect(requestTypeSchema.parse("STUDENT_ID_RENEWAL")).toBe("STUDENT_ID_RENEWAL");
    expect(requestTypeSchema.safeParse("UNKNOWN").success).toBe(false);
  });

  it("accepts known statuses and rejects unknown ones", ({ expect }) => {
    expect(requestStatusSchema.parse("ready")).toBe("ready");
    expect(requestStatusSchema.safeParse("pending").success).toBe(false);
  });

  it("accepts known email kinds and rejects unknown ones", ({ expect }) => {
    expect(emailKindSchema.parse("READY_NOTICE")).toBe("READY_NOTICE");
    expect(emailKindSchema.safeParse("OTHER").success).toBe(false);
  });
});

describe("scalar request schemas", () => {
  it("bounds the graduation year", ({ expect }) => {
    expect(graduationYearSchema.parse(MIN_GRADUATION_YEAR)).toBe(MIN_GRADUATION_YEAR);
    expect(graduationYearSchema.parse(MAX_GRADUATION_YEAR)).toBe(MAX_GRADUATION_YEAR);
    expect(graduationYearSchema.safeParse(MIN_GRADUATION_YEAR - 1).success).toBe(false);
    expect(graduationYearSchema.safeParse(MAX_GRADUATION_YEAR + 1).success).toBe(false);
    expect(graduationYearSchema.safeParse(2_020.5).success).toBe(false);
  });

  it("trims and lowercases emails", ({ expect }) => {
    expect(emailSchema.parse("  Jan@Example.COM ")).toBe("jan@example.com");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("normalises notes and drops empty ones", ({ expect }) => {
    expect(noteSchema.parse("   Załącznik  ")).toBe("Załącznik");
    expect(noteSchema.parse("   ")).toBeUndefined();
    expect(noteSchema.parse("á".repeat(250))).toHaveLength(250);
    expect(noteSchema.safeParse("x".repeat(501)).success).toBe(false);
  });

  it("validates status tokens by shape", ({ expect }) => {
    expect(tokenSchema.parse(TOKEN)).toBe(TOKEN);
    expect(tokenSchema.safeParse("a".repeat(42)).success).toBe(false);
    expect(tokenSchema.safeParse("a".repeat(44)).success).toBe(false);
    expect(tokenSchema.safeParse(`${"a".repeat(41)}?##`).success).toBe(false);
  });
});

describe("requestInputSchema", () => {
  it("accepts a student id renewal and normalises the class", ({ expect }) => {
    const parsed = requestInputSchema.parse({
      ...baseInput,
      type: "STUDENT_ID_RENEWAL",
      className: " 4TP ",
    });
    expect(parsed).toMatchObject({ type: "STUDENT_ID_RENEWAL", className: "4tp" });
  });

  it("accepts a student id duplicate", ({ expect }) => {
    const parsed = requestInputSchema.parse({
      ...baseInput,
      type: "STUDENT_ID_DUPLICATE",
      className: "1lst",
      note: "  ",
    });
    expect(parsed).toMatchObject({ type: "STUDENT_ID_DUPLICATE" });
    expect(parsed.note).toBeUndefined();
  });

  it("accepts an enrollment certificate with a class or a graduation year", ({ expect }) => {
    const withClass = requestInputSchema.parse({
      ...baseInput,
      type: "ENROLLMENT_CERTIFICATE",
      className: "5ta",
    });
    const withYear = requestInputSchema.parse({
      ...baseInput,
      type: "ENROLLMENT_CERTIFICATE",
      graduationYear: 2024,
    });
    const withBoth = requestInputSchema.parse({
      ...baseInput,
      type: "ENROLLMENT_CERTIFICATE",
      className: "5ta",
      graduationYear: 2024,
    });
    expect(withClass).toMatchObject({ type: "ENROLLMENT_CERTIFICATE", className: "5ta" });
    expect(withYear).toMatchObject({ type: "ENROLLMENT_CERTIFICATE", graduationYear: 2024 });
    expect(withBoth).toMatchObject({ type: "ENROLLMENT_CERTIFICATE", graduationYear: 2024 });
  });

  it("requires a class name or a graduation year on an enrollment certificate", ({ expect }) => {
    const result = requestInputSchema.safeParse({
      ...baseInput,
      type: "ENROLLMENT_CERTIFICATE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown types, unknown classes and extra keys", ({ expect }) => {
    expect(
      requestInputSchema.safeParse({ ...baseInput, type: "OTHER", className: "4tp" }).success,
    ).toBe(false);
    expect(
      requestInputSchema.safeParse({ ...baseInput, type: "STUDENT_ID_RENEWAL", className: "9xx" })
        .success,
    ).toBe(false);
    expect(
      requestInputSchema.safeParse({
        ...baseInput,
        type: "STUDENT_ID_RENEWAL",
        className: "4tp",
        extra: 1,
      }).success,
    ).toBe(false);
    expect(
      requestInputSchema.safeParse({
        ...baseInput,
        type: "STUDENT_ID_RENEWAL",
        className: "4tp",
        noticesAccepted: false,
      }).success,
    ).toBe(false);
    expect(
      requestInputSchema.safeParse({
        ...baseInput,
        type: "STUDENT_ID_RENEWAL",
        className: "4tp",
        honeypot: "spam",
      }).success,
    ).toBe(false);
    expect(
      requestInputSchema.safeParse({
        ...baseInput,
        type: "STUDENT_ID_RENEWAL",
        className: "4tp",
        firstName: "   ",
      }).success,
    ).toBe(false);
  });
});
