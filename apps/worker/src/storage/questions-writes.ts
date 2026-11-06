import { auditValues, type AuditEntry } from "./audit-repo.ts";
import { timestamp, type SqlStatement, type Store } from "./database.ts";
import type { SealedText } from "./questions-repo.ts";
import {
  DELETE_QUESTION,
  INSERT_AUDIT_FOR_VERSION,
  PUBLISH,
  REJECT,
  SAVE_DRAFT,
  WITHDRAW,
} from "./questions-sql.ts";
import { warsawDay } from "../domain/question-lifecycle.ts";

export type QuestionWrite =
  | { readonly kind: "draft"; readonly draft: SealedText }
  | {
      readonly kind: "publish";
      readonly question: string;
      readonly answer: string;
      readonly slug: string;
    }
  | { readonly kind: "reject" }
  | { readonly kind: "withdraw" }
  | { readonly kind: "delete" };

export interface QuestionWriteRequest {
  readonly id: string;
  readonly expectedVersion: number;
  readonly write: QuestionWrite;
  readonly audit: AuditEntry;
}

export interface QuestionWriteBatch {
  readonly statements: readonly SqlStatement[];
  applied(changes: readonly number[]): boolean;
}

function changeStatement(
  store: Store,
  { id, expectedVersion, write }: QuestionWriteRequest,
): SqlStatement {
  const { db } = store;
  const now = timestamp(store.clock);
  switch (write.kind) {
    case "draft":
      return db
        .prepare(SAVE_DRAFT)
        .bind(write.draft.ciphertext, write.draft.keyId, now, id, expectedVersion);
    case "publish":
      return db
        .prepare(PUBLISH)
        .bind(
          write.question,
          write.answer,
          warsawDay(new Date(now)),
          write.slug,
          now,
          id,
          expectedVersion,
        );
    case "reject":
      return db.prepare(REJECT).bind(now, id, expectedVersion);
    case "withdraw":
      return db.prepare(WITHDRAW).bind(now, id, expectedVersion);
    case "delete":
      return db.prepare(DELETE_QUESTION).bind(id, expectedVersion);
  }
}

export function questionWriteBatch(
  store: Store,
  request: QuestionWriteRequest,
): QuestionWriteBatch {
  const audit = store.db
    .prepare(INSERT_AUDIT_FOR_VERSION)
    .bind(...auditValues(store, request.audit), request.id, request.expectedVersion);
  const statements = [audit, changeStatement(store, request)];
  return {
    statements,
    applied: (changes) => changes.at(1) === 1,
  };
}
