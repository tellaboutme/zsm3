import type { EmailKind, RequestStatus } from "@zsm3/contracts/requests";

import { timestamp, type SqlStatement, type Store } from "./database.ts";
import { uuidv7 } from "./ids.ts";
import { INSERT_OUTBOX_AFTER_TRANSITION } from "./outbox-sql.ts";
import { UPDATE_TRANSITION } from "./requests-sql.ts";
import { isOpen } from "../domain/request-lifecycle.ts";

const NOTICE_KINDS: Readonly<Record<RequestStatus, EmailKind | null>> = {
  submitted: null,
  in_progress: null,
  ready: "READY_NOTICE",
  collected: null,
  rejected: "REJECTED_NOTICE",
  withdrawn: null,
};

export function buildTransitionStatements(
  store: Store,
  id: string,
  to: RequestStatus,
  origin: string,
): readonly SqlStatement[] {
  const { db, clock, random } = store;
  const now = timestamp(clock);
  const update = db.prepare(UPDATE_TRANSITION).bind(to, now, isOpen(to) ? null : now, id);
  const kind = NOTICE_KINDS[to];
  if (kind === null) {
    return [update];
  }
  return [
    update,
    db
      .prepare(INSERT_OUTBOX_AFTER_TRANSITION)
      .bind(uuidv7(clock().getTime(), random), kind, id, origin, now, to),
  ];
}
