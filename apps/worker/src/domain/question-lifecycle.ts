import type { QuestionDecision, QuestionStatus } from "@zsm3/contracts/questions";

export type QuestionChange = "draft" | QuestionDecision;

export const UNANSWERED_RETENTION_DAYS = 90;
export const CLOSED_RETENTION_DAYS = 30;

const ALLOWED_FROM: Readonly<Record<QuestionChange, readonly QuestionStatus[]>> = {
  draft: ["received", "draft", "withdrawn"],
  publish: ["draft"],
  reject: ["received", "draft", "withdrawn"],
  withdraw: ["published"],
  delete: ["received", "draft", "rejected", "withdrawn"],
};

const TARGET: Readonly<Record<Exclude<QuestionChange, "delete">, QuestionStatus>> = {
  draft: "draft",
  publish: "published",
  reject: "rejected",
  withdraw: "withdrawn",
};

export function canChange(change: QuestionChange, from: QuestionStatus): boolean {
  return ALLOWED_FROM[change].includes(from);
}

export function targetStatus(change: Exclude<QuestionChange, "delete">): QuestionStatus {
  return TARGET[change];
}

export function isClosed(status: QuestionStatus): boolean {
  return status === "rejected" || status === "withdrawn";
}

export interface RetentionCutoffs {
  readonly unanswered: string;
  readonly closed: string;
}

const DAY_MS = 86_400_000;

export function warsawDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function retentionCutoffs(now: Date): RetentionCutoffs {
  return {
    unanswered: new Date(now.getTime() - UNANSWERED_RETENTION_DAYS * DAY_MS).toISOString(),
    closed: new Date(now.getTime() - CLOSED_RETENTION_DAYS * DAY_MS).toISOString(),
  };
}
