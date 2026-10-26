import type { RequestStatus, RequestType } from "@zsm3/contracts/requests";

import { isOpen } from "./request-lifecycle.ts";

export const CLOSED_PII_RETENTION_DAYS = 30;
export const OPEN_INACTIVITY_DAYS = 90;
export const ANONYMOUS_RETENTION_YEARS = 2;

const DAY_MS = 86_400_000;
const YEAR_MS = 365 * DAY_MS;

export interface RetentionRow {
  readonly id: string;
  readonly type: RequestType;
  readonly status: RequestStatus;
  readonly updatedAt: string;
  readonly closedAt: string | null;
  readonly piiErasedAt: string | null;
}

export type RetentionAction =
  | { readonly kind: "erase"; readonly requestId: string }
  | { kind: "reject"; requestId: string }
  | { kind: "delete"; requestId: string };

export function retentionActions(
  now: Date,
  rows: readonly RetentionRow[],
): readonly RetentionAction[] {
  return rows.flatMap((row) => actionFor(now, row));
}

function actionFor(now: Date, row: RetentionRow): RetentionAction[] {
  if (row.piiErasedAt !== null) {
    return olderThan(now, row.piiErasedAt, ANONYMOUS_RETENTION_YEARS * YEAR_MS)
      ? [{ kind: "delete", requestId: row.id }]
      : [];
  }
  if (row.status === "withdrawn") {
    return [{ kind: "erase", requestId: row.id }];
  }
  if (isOpen(row.status)) {
    return olderThan(now, row.updatedAt, OPEN_INACTIVITY_DAYS * DAY_MS)
      ? [{ kind: "reject", requestId: row.id }]
      : [];
  }
  return row.closedAt !== null && olderThan(now, row.closedAt, CLOSED_PII_RETENTION_DAYS * DAY_MS)
    ? [{ kind: "erase", requestId: row.id }]
    : [];
}

function olderThan(now: Date, since: string, ageMs: number): boolean {
  return now.getTime() - Date.parse(since) >= ageMs;
}
