import { firstRow, timestamp, type SqlStatement, type Store } from "./database.ts";
import { uuidv7 } from "./ids.ts";
import { INSERT_OUTBOX_FOR_NEW_REQUEST } from "./outbox-sql.ts";
import {
  requestRowSchema,
  toRecord,
  type CreateRequestData,
  type CreateRequestOutcome,
  type RequestRecord,
} from "./requests-rows.ts";
import { INSERT_REQUEST_WITH_LIMIT, SELECT_BY_FORM_KEY, SELECT_ONE } from "./requests-sql.ts";

async function oneRow(statement: SqlStatement): Promise<RequestRecord | undefined> {
  const row = await firstRow(statement, requestRowSchema);
  return row === undefined ? undefined : toRecord(row);
}

function batchStatements(store: Store, data: CreateRequestData, origin: string, limit: number) {
  const { db, clock, random } = store;
  const now = timestamp(clock);
  return [
    db
      .prepare(INSERT_REQUEST_WITH_LIMIT)
      .bind(
        data.id,
        data.type,
        "submitted",
        data.piiCiphertext,
        data.piiKeyId,
        data.emailIndex,
        data.statusTokenHash,
        data.formKey,
        now,
        now,
        limit,
      ),
    ...(["SUBMISSION_CONFIRMATION", "SECRETARIAT_NOTICE"] as const).map((kind) =>
      db
        .prepare(INSERT_OUTBOX_FOR_NEW_REQUEST)
        .bind(uuidv7(clock().getTime(), random), kind, data.id, origin, now, data.statusTokenHash),
    ),
  ];
}

export async function createWithConfirmations(
  store: Store,
  data: CreateRequestData,
  origin: string,
  limit: number,
): Promise<CreateRequestOutcome | { readonly kind: "open_limit" }> {
  const { db } = store;
  try {
    await db.batch(batchStatements(store, data, origin, limit));
  } catch (error) {
    if (!String(error).includes("UNIQUE constraint failed: requests.form_key")) {
      throw error;
    }
    const record = await oneRow(db.prepare(SELECT_BY_FORM_KEY).bind(data.formKey));
    if (record === undefined) {
      throw error;
    }
    return { kind: "duplicate", record };
  }
  const record = await oneRow(db.prepare(SELECT_ONE).bind(data.id));
  if (record !== undefined) {
    return { kind: "created", record };
  }
  const duplicate = await oneRow(db.prepare(SELECT_BY_FORM_KEY).bind(data.formKey));
  return duplicate === undefined
    ? { kind: "open_limit" }
    : { kind: "duplicate", record: duplicate };
}
