import { describe, it } from "vitest";

import {
  panelRequestDetailSchema,
  panelRequestSummarySchema,
  requestPiiSchema,
  requestTypeMeta,
  statusResponseSchema,
  submissionResponseSchema,
} from "../src/requests.ts";

const TOKEN = "a".repeat(43);

describe("response schemas", () => {
  it("parses request pii", ({ expect }) => {
    const pii = {
      firstName: "Jan",
      lastName: "Przykładowy",
      email: "jan@example.com",
      className: "4tp",
      note: "Notka",
      statusToken: TOKEN,
    };
    expect(requestPiiSchema.parse(pii)).toEqual(pii);
    expect(requestPiiSchema.safeParse({ ...pii, extra: 1 }).success).toBe(false);
  });

  it("parses status and submission responses", ({ expect }) => {
    const status = {
      type: "STUDENT_ID_RENEWAL",
      status: "ready",
      updatedAt: "2026-10-22T08:00:00.000Z",
      collectionMessage: "Dokument jest gotowy.",
    };
    expect(statusResponseSchema.parse(status)).toEqual(status);
    expect(statusResponseSchema.safeParse({ ...status, extra: 1 }).success).toBe(false);
    const submission = { statusUrl: "https://zsm3.test/e-wniosek/status#tok" };
    expect(submissionResponseSchema.parse(submission)).toEqual(submission);
    expect(submissionResponseSchema.safeParse({ statusUrl: "" }).success).toBe(false);
  });

  it("parses panel summaries and details", ({ expect }) => {
    const summary = {
      id: "11111111-2222-4333-8444-555555555555",
      type: "STUDENT_ID_RENEWAL",
      status: "submitted",
      createdAt: "2026-10-22T08:00:00.000Z",
      updatedAt: "2026-10-22T08:00:00.000Z",
    };
    expect(panelRequestSummarySchema.parse(summary)).toEqual(summary);
    const detail = {
      ...summary,
      firstName: "Jan",
      lastName: "Przykładowy",
      className: null,
      graduationYear: null,
      email: "jan@example.com",
      note: null,
      piiErasedAt: null,
    };
    expect(panelRequestDetailSchema.parse(detail)).toEqual(detail);
    expect(panelRequestSummarySchema.safeParse(detail).success).toBe(false);
    expect(panelRequestDetailSchema.safeParse(summary).success).toBe(false);
  });
});

describe("requestTypeMeta", () => {
  it("labels every request type in Polish", ({ expect }) => {
    expect(requestTypeMeta.STUDENT_ID_RENEWAL.label).toBe("Wymiana legitymacji szkolnej");
    expect(requestTypeMeta.STUDENT_ID_DUPLICATE.label).toBe("Duplikat legitymacji szkolnej");
    expect(requestTypeMeta.ENROLLMENT_CERTIFICATE.label).toBe(
      "Zaświadczenie o uczęszczaniu do szkoły",
    );
    expect(requestTypeMeta.ENROLLMENT_CERTIFICATE.description).toContain("sekretariat");
  });
});
