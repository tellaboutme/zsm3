import type { RequestStatus } from "@zsm3/contracts/requests";
import { z } from "zod";

import {
  allRows,
  batchChanges,
  firstRow,
  timestamp,
  type Clock,
  type SqlDatabase,
  type SqlStatement,
  type Store,
} from "./database.ts";
import { DELETE_WITHDRAWN_FAILURES, DELETE_WITHDRAWN_OUTBOX } from "./outbox-sql.ts";
import { closeInactiveRequests, deleteErasedRequests, eraseAndCancel } from "./requests-cleanup.ts";
import { createWithConfirmations } from "./requests-create.ts";
import {
  requestRowSchema,
  toRecord,
  type CreateRequestData,
  type CreateRequestOutcome,
  type RequestListFilter,
  type RequestRecord,
} from "./requests-rows.ts";
import {
  COUNT_OPEN_BY_EMAIL,
  INSERT_REQUEST,
  SELECT_BY_FORM_KEY,
  SELECT_BY_TOKEN_HASH,
  SELECT_CLOSED_BEFORE,
  SELECT_ERASED_BEFORE,
  SELECT_INACTIVE,
  SELECT_LIST,
  SELECT_ONE,
  UPDATE_ERASE_PII,
  UPDATE_TRANSITION,
  WITHDRAW_OPEN,
  WITHDRAW_ERASE,
} from "./requests-sql.ts";
import { assertTransition, isOpen } from "../domain/request-lifecycle.ts";

export const MAX_OPEN_REQUESTS = 3;

export type { CreateRequestData, CreateRequestOutcome, RequestListFilter, RequestRecord };

export interface RequestsRepo {
  create(data: CreateRequestData): Promise<CreateRequestOutcome>;
  createWithConfirmations(
    data: CreateRequestData,
    origin: string,
  ): Promise<CreateRequestOutcome | { readonly kind: "open_limit" }>;
  findById(id: string): Promise<RequestRecord | undefined>;
  findByTokenHash(tokenHash: Uint8Array): Promise<RequestRecord | undefined>;
  countOpenByEmailIndex(emailIndex: Uint8Array): Promise<number>;
  transition(id: string, to: RequestStatus): Promise<RequestRecord>;
  list(filter: RequestListFilter): Promise<readonly RequestRecord[]>;
  listInactive(before: string, limit: number): Promise<readonly RequestRecord[]>;
  listClosedBefore(before: string, limit: number): Promise<readonly RequestRecord[]>;
  listErasedBefore(before: string, limit: number): Promise<readonly RequestRecord[]>;
  closeInactive(ids: readonly string[], at: string, before: string): Promise<number>;
  erasePii(id: string, at: string): Promise<void>;
  eraseAndCancel(id: string, at: string): Promise<void>;
  withdrawAndErase(id: string, at: string): Promise<RequestRecord>;
  deleteErased(ids: readonly string[]): Promise<void>;
}

function isFormKeyConflict(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("UNIQUE constraint failed: requests.form_key")
  );
}

async function oneRow(statement: SqlStatement): Promise<RequestRecord | undefined> {
  const row = await firstRow(statement, requestRowSchema);
  return row === undefined ? undefined : toRecord(row);
}

async function manyRows(statement: SqlStatement): Promise<readonly RequestRecord[]> {
  const rows = await allRows(statement, requestRowSchema);
  return rows.map(toRecord);
}

async function mustFind(statement: SqlStatement, id: string): Promise<RequestRecord> {
  const record = await oneRow(statement);
  if (record === undefined) {
    throw new Error(`The request row ${id} is missing`);
  }
  return record;
}

async function createRequest(
  db: SqlDatabase,
  clock: Clock,
  data: CreateRequestData,
): Promise<CreateRequestOutcome> {
  const now = timestamp(clock);
  try {
    await db
      .prepare(INSERT_REQUEST)
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
      )
      .run();
    return {
      kind: "created",
      record: await mustFind(db.prepare(SELECT_ONE).bind(data.id), data.id),
    };
  } catch (error) {
    if (isFormKeyConflict(error)) {
      const record = await oneRow(db.prepare(SELECT_BY_FORM_KEY).bind(data.formKey));
      if (record !== undefined) {
        return { kind: "duplicate", record };
      }
    }
    throw error;
  }
}

async function countOpen(db: SqlDatabase, emailIndex: Uint8Array): Promise<number> {
  const rows = await allRows(
    db.prepare(COUNT_OPEN_BY_EMAIL).bind(emailIndex),
    z.object({ total: z.number() }),
  );
  return rows.reduce((sum, row) => sum + row.total, 0);
}

async function transitionRequest(
  db: SqlDatabase,
  clock: Clock,
  id: string,
  to: RequestStatus,
): Promise<RequestRecord> {
  const current = await mustFind(db.prepare(SELECT_ONE).bind(id), id);
  assertTransition(current.status, to);
  const now = timestamp(clock);
  await db
    .prepare(UPDATE_TRANSITION)
    .bind(to, now, isOpen(to) ? null : now, id)
    .run();
  return mustFind(db.prepare(SELECT_ONE).bind(id), id);
}

async function withdrawAndEraseRequest(
  db: SqlDatabase,
  id: string,
  at: string,
): Promise<RequestRecord> {
  const current = await mustFind(db.prepare(SELECT_ONE).bind(id), id);
  assertTransition(current.status, "withdrawn");
  const [changed] = batchChanges(
    await db.batch([
      db.prepare(WITHDRAW_OPEN).bind(at, id),
      db.prepare(WITHDRAW_ERASE).bind(at, id),
      db.prepare(DELETE_WITHDRAWN_OUTBOX).bind(id, at),
      db.prepare(DELETE_WITHDRAWN_FAILURES).bind(id, at),
    ]),
  );
  if (changed === 0) return mustFind(db.prepare(SELECT_ONE).bind(id), id);
  return mustFind(db.prepare(SELECT_ONE).bind(id), id);
}

export function requestsRepo(store: Store): RequestsRepo {
  const { db, clock } = store;

  return {
    create: async (data) => createRequest(db, clock, data),
    createWithConfirmations: async (data, origin) =>
      createWithConfirmations(store, data, origin, MAX_OPEN_REQUESTS),
    findById: async (id) => oneRow(db.prepare(SELECT_ONE).bind(id)),
    findByTokenHash: async (tokenHash) => oneRow(db.prepare(SELECT_BY_TOKEN_HASH).bind(tokenHash)),
    countOpenByEmailIndex: async (emailIndex) => countOpen(db, emailIndex),
    transition: async (id, to) => transitionRequest(db, clock, id, to),
    list: async (filter) =>
      manyRows(
        db.prepare(SELECT_LIST).bind(filter.status ?? null, filter.before ?? null, filter.limit),
      ),
    listInactive: async (before, limit) =>
      manyRows(db.prepare(SELECT_INACTIVE).bind(before, limit)),
    listClosedBefore: async (before, limit) =>
      manyRows(db.prepare(SELECT_CLOSED_BEFORE).bind(before, limit)),
    listErasedBefore: async (before, limit) =>
      manyRows(db.prepare(SELECT_ERASED_BEFORE).bind(before, limit)),
    closeInactive: async (ids, at, before) => closeInactiveRequests(store, ids, at, before),
    erasePii: async (id, at) => {
      await db.prepare(UPDATE_ERASE_PII).bind(at, id).run();
    },
    eraseAndCancel: async (id, at) => eraseAndCancel(db, id, at),
    withdrawAndErase: async (id, at) => withdrawAndEraseRequest(db, id, at),
    deleteErased: async (ids) => deleteErasedRequests(db, ids),
  };
}
