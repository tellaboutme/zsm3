import { batchChanges, type SqlDatabase, type Store } from "./database.ts";
import { uuidv7 } from "./ids.ts";
import {
  DELETE_FAILURES_FOR_REQUEST,
  DELETE_OUTBOX_FOR_REQUEST,
  INSERT_INACTIVE_REJECTION,
} from "./outbox-sql.ts";
import { CLOSE_INACTIVE, DELETE_ERASED, UPDATE_ERASE_PII } from "./requests-sql.ts";

export async function closeInactiveRequests(
  store: Store,
  ids: readonly string[],
  at: string,
  before: string,
): Promise<number> {
  const { db, clock, random } = store;
  let closed = 0;
  for (const id of ids) {
    const [changed] = batchChanges(
      await db.batch([
        db.prepare(CLOSE_INACTIVE).bind(at, id, before),
        db.prepare(INSERT_INACTIVE_REJECTION).bind(uuidv7(clock().getTime(), random), id, at),
      ]),
    );
    if (changed === 1) closed += 1;
  }
  return closed;
}

export async function eraseAndCancel(db: SqlDatabase, id: string, at: string): Promise<void> {
  await db.batch([
    db.prepare(UPDATE_ERASE_PII).bind(at, id),
    db.prepare(DELETE_OUTBOX_FOR_REQUEST).bind(id),
    db.prepare(DELETE_FAILURES_FOR_REQUEST).bind(id),
  ]);
}

export async function deleteErasedRequests(db: SqlDatabase, ids: readonly string[]): Promise<void> {
  await db.batch(
    ids.flatMap((id) => [
      db.prepare(DELETE_OUTBOX_FOR_REQUEST).bind(id),
      db.prepare(DELETE_FAILURES_FOR_REQUEST).bind(id),
      db.prepare(DELETE_ERASED).bind(id),
    ]),
  );
}
