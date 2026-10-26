import { describe, it } from "vitest";

import {
  CLOSED_PII_RETENTION_DAYS,
  OPEN_INACTIVITY_DAYS,
  retentionActions,
  type RetentionRow,
} from "../../src/domain/retention-policy.ts";

const NOW = new Date("2026-10-22T08:00:00Z");

function row(overrides: Partial<RetentionRow>): RetentionRow {
  return {
    id: "request-1",
    type: "STUDENT_ID_RENEWAL",
    status: "submitted",
    updatedAt: "2026-10-01T08:00:00Z",
    closedAt: null,
    piiErasedAt: null,
    ...overrides,
  };
}

describe("retentionActions", () => {
  it("erases withdrawn rows immediately", ({ expect }) => {
    expect(
      retentionActions(NOW, [row({ status: "withdrawn", closedAt: NOW.toISOString() })]),
    ).toEqual([{ kind: "erase", requestId: "request-1" }]);
  });

  it("rejects open rows after the inactivity window", ({ expect }) => {
    const fresh = row({
      updatedAt: new Date(NOW.getTime() - OPEN_INACTIVITY_DAYS * 86_400_000 + 1).toISOString(),
    });
    const stale = row({
      id: "stale",
      updatedAt: new Date(NOW.getTime() - OPEN_INACTIVITY_DAYS * 86_400_000).toISOString(),
    });
    const staleInProgress = row({
      id: "stale-2",
      status: "in_progress",
      updatedAt: "2025-01-01T00:00:00Z",
    });
    const staleReady = row({ id: "stale-3", status: "ready", updatedAt: "2020-01-01T00:00:00Z" });

    expect(retentionActions(NOW, [fresh, stale, staleInProgress, staleReady])).toEqual([
      { kind: "reject", requestId: "stale" },
      { kind: "reject", requestId: "stale-2" },
      { kind: "reject", requestId: "stale-3" },
    ]);
  });

  it("erases closed rows after the closed retention window", ({ expect }) => {
    const boundary = new Date(NOW.getTime() - CLOSED_PII_RETENTION_DAYS * 86_400_000).toISOString();
    const fresh = row({
      status: "collected",
      closedAt: new Date(NOW.getTime() - 86_400_000).toISOString(),
    });
    const old = row({ id: "old", status: "collected", closedAt: boundary });
    const rejected = row({ id: "rejected", status: "rejected", closedAt: "2020-01-01T00:00:00Z" });

    expect(retentionActions(NOW, [fresh, old, rejected])).toEqual([
      { kind: "erase", requestId: "old" },
      { kind: "erase", requestId: "rejected" },
    ]);
  });

  it("deletes anonymous rows after the anonymous retention window", ({ expect }) => {
    const fresh = row({ piiErasedAt: new Date(NOW.getTime() - 30 * 86_400_000).toISOString() });
    const old = row({ id: "old", piiErasedAt: "2020-01-01T00:00:00Z" });

    expect(retentionActions(NOW, [fresh, old])).toEqual([{ kind: "delete", requestId: "old" }]);
  });

  it("leaves rows without an action alone", ({ expect }) => {
    expect(retentionActions(NOW, [])).toEqual([]);
  });
});
