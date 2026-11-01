import { describe, expect, it } from "vitest";

import {
  panelRequestsListSchema,
  panelRequestsQuerySchema,
  panelRequestTransitionSchema,
} from "../src/panel-requests.ts";
import { panelRequestDetailSchema, panelRequestSummarySchema } from "../src/requests.ts";

describe("panel requests contracts", () => {
  const summary = {
    id: "11111111-2222-4333-8444-555555555555",
    type: "STUDENT_ID_RENEWAL" as const,
    status: "submitted" as const,
    createdAt: "2026-10-22T08:00:00.000Z",
    updatedAt: "2026-10-22T08:00:00.000Z",
  };

  it("parses query parameters with defaults and validation", () => {
    expect(panelRequestsQuerySchema.parse({})).toEqual({
      limit: 20,
    });
    expect(
      panelRequestsQuerySchema.parse({
        status: "in_progress",
        before: "2026-10-22T08:00:00.000Z",
        limit: "10",
      }),
    ).toEqual({
      status: "in_progress",
      before: "2026-10-22T08:00:00.000Z",
      limit: 10,
    });
    expect(panelRequestsQuerySchema.parse({ limit: "50" }).limit).toBe(50);
    expect(panelRequestsQuerySchema.safeParse({ limit: "999" }).success).toBe(false);
    expect(panelRequestsQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(panelRequestsQuerySchema.safeParse({ limit: "invalid" }).success).toBe(false);
    expect(panelRequestsQuerySchema.safeParse({ status: "unknown" }).success).toBe(false);
    expect(panelRequestsQuerySchema.safeParse({ before: "invalid-date" }).success).toBe(false);
    expect(panelRequestsQuerySchema.safeParse({ extra: 1 }).success).toBe(false);
  });

  it("parses request list envelopes", () => {
    const list = {
      items: [summary],
      nextBefore: "2026-10-22T08:00:00.000Z",
    };
    expect(panelRequestsListSchema.parse(list)).toEqual(list);
    expect(panelRequestsListSchema.parse({ items: [], nextBefore: null })).toEqual({
      items: [],
      nextBefore: null,
    });
    expect(panelRequestsListSchema.safeParse({ items: [summary] }).success).toBe(false);
    expect(
      panelRequestsListSchema.safeParse({
        items: [{ ...summary, status: "unknown" }],
        nextBefore: null,
      }).success,
    ).toBe(false);
  });

  it("parses request transition input", () => {
    expect(panelRequestTransitionSchema.parse({ to: "in_progress" })).toEqual({
      to: "in_progress",
    });
    expect(panelRequestTransitionSchema.parse({ to: "ready" })).toEqual({
      to: "ready",
    });
    expect(panelRequestTransitionSchema.safeParse({ to: "unknown" }).success).toBe(false);
    expect(panelRequestTransitionSchema.safeParse({}).success).toBe(false);
    expect(panelRequestTransitionSchema.safeParse({ to: "ready", extra: 1 }).success).toBe(false);
  });

  it("parses request detail for a live record and for erased personal data", () => {
    const liveDetail = {
      ...summary,
      firstName: "Jan",
      lastName: "Kowalski",
      className: "4ta",
      graduationYear: 2026,
      email: "jan.kowalski@zsm3.test",
      note: "Prosze o szybkie wydanie",
      piiErasedAt: null,
    };
    expect(panelRequestDetailSchema.parse(liveDetail)).toEqual(liveDetail);
    const erasedDetail = {
      ...summary,
      firstName: null,
      lastName: null,
      className: null,
      graduationYear: null,
      email: null,
      note: null,
      piiErasedAt: "2026-10-25T08:00:00.000Z",
    };
    expect(panelRequestDetailSchema.parse(erasedDetail)).toEqual(erasedDetail);
    expect(panelRequestSummarySchema.safeParse(erasedDetail).success).toBe(false);
  });
});
