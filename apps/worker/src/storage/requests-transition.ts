import type { EmailKind, RequestStatus } from "@zsm3/contracts/requests";

import { auditValues, type AuditEntry } from "./audit-repo.ts";
import { timestamp, type SqlStatement, type Store } from "./database.ts";
import { uuidv7 } from "./ids.ts";
import { DELETE_PENDING_READY_NOTICE, INSERT_OUTBOX_FOR_TRANSITION } from "./outbox-sql.ts";
import { INSERT_AUDIT_FOR_TRANSITION, UPDATE_TRANSITION_FROM } from "./requests-sql.ts";
import { isOpen } from "../domain/request-lifecycle.ts";

const NOTICE_KINDS: Readonly<Record<RequestStatus, EmailKind | null>> = {
  submitted: null,
  in_progress: null,
  ready: "READY_NOTICE",
  collected: null,
  rejected: "REJECTED_NOTICE",
  withdrawn: null,
};

export interface RequestTransition {
  readonly id: string;
  readonly from: RequestStatus;
  readonly to: RequestStatus;
  readonly origin: string;
  readonly audit: AuditEntry;
}

export interface TransitionBatch {
  readonly statements: readonly SqlStatement[];
  applied(changes: readonly number[]): boolean;
}

export function buildTransitionStatements(
  store: Store,
  { id, from, to, origin, audit }: RequestTransition,
): TransitionBatch {
  const { db, clock, random } = store;
  const now = timestamp(clock);
  const kind = NOTICE_KINDS[to];
  const notice =
    kind === null
      ? []
      : [
          db
            .prepare(INSERT_OUTBOX_FOR_TRANSITION)
            .bind(uuidv7(clock().getTime(), random), kind, id, origin, now, from),
        ];
  const staleReadyNotice =
    from === "ready" ? [db.prepare(DELETE_PENDING_READY_NOTICE).bind(id)] : [];
  const statements = [
    db.prepare(INSERT_AUDIT_FOR_TRANSITION).bind(...auditValues(store, audit), id, from),
    ...staleReadyNotice,
    ...notice,
    db.prepare(UPDATE_TRANSITION_FROM).bind(to, now, isOpen(to) ? null : now, id, from),
  ];
  return {
    statements,
    applied: (changes) => changes.at(statements.length - 1) === 1,
  };
}
