import type { EmailKind, RequestStatus } from "@zsm3/contracts/requests";

import { auditValues, type AuditEntry } from "./audit-repo.ts";
import { timestamp, type SqlStatement, type Store } from "./database.ts";
import { uuidv7 } from "./ids.ts";
import { INSERT_OUTBOX_AFTER_TRANSITION } from "./outbox-sql.ts";
import { INSERT_AUDIT_AFTER_TRANSITION, UPDATE_TRANSITION_FROM } from "./requests-sql.ts";
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

export function buildTransitionStatements(
  store: Store,
  { id, from, to, origin, audit }: RequestTransition,
): readonly SqlStatement[] {
  const { db, clock, random } = store;
  const now = timestamp(clock);
  const statements = [
    db.prepare(UPDATE_TRANSITION_FROM).bind(to, now, isOpen(to) ? null : now, id, from),
    db.prepare(INSERT_AUDIT_AFTER_TRANSITION).bind(...auditValues(store, audit), to, now),
  ];
  const kind = NOTICE_KINDS[to];
  if (kind === null) {
    return statements;
  }
  return [
    ...statements,
    db
      .prepare(INSERT_OUTBOX_AFTER_TRANSITION)
      .bind(uuidv7(clock().getTime(), random), kind, id, origin, now, to),
  ];
}
