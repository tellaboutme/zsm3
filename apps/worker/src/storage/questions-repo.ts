import {
  publicQuestionSchema,
  QUESTION_SLUG_LENGTH,
  questionAddresseeSchema,
  questionStatusSchema,
  type PublicQuestion,
  type QuestionAddressee,
  type QuestionStatus,
} from "@zsm3/contracts/questions";
import { z } from "zod";

import { allRows, batchChanges, firstRow, type Store } from "./database.ts";
import { publicSlug } from "./ids.ts";
import {
  COUNT_PUBLISHED,
  INSERT_QUESTION,
  LIST_PUBLISHED,
  LIST_QUESTIONS,
  PRUNE_QUESTIONS,
  SELECT_PUBLISHED,
  SELECT_QUESTION,
} from "./questions-sql.ts";
import {
  questionWriteBatch,
  type QuestionWriteBatch,
  type QuestionWriteRequest,
} from "./questions-writes.ts";
import { bytesSchema } from "./requests-rows.ts";
import type { RetentionCutoffs } from "../domain/question-lifecycle.ts";

export interface SealedText {
  readonly ciphertext: Uint8Array;
  readonly keyId: string;
}

export interface QuestionArrival {
  readonly id: string;
  readonly addressee: QuestionAddressee;
  readonly question: SealedText;
  readonly formKey: string;
  readonly receivedOn: string;
}

export interface QuestionSummaryRecord {
  readonly id: string;
  readonly addressee: QuestionAddressee;
  readonly status: QuestionStatus;
  readonly version: number;
  readonly receivedOn: string;
}

export interface QuestionRecord extends QuestionSummaryRecord {
  readonly question: SealedText | null;
  readonly draft: SealedText | null;
  readonly publicSlug: string | null;
  readonly publishedOn: string | null;
}

export interface QuestionListFilter {
  readonly status?: QuestionStatus | undefined;
  readonly before?: string | undefined;
  readonly beforeId?: string | undefined;
  readonly limit: number;
}

export interface QuestionsRepo {
  receive(arrival: QuestionArrival): Promise<boolean>;
  list(filter: QuestionListFilter): Promise<readonly QuestionSummaryRecord[]>;
  find(id: string): Promise<QuestionRecord | undefined>;
  published(limit: number, offset: number): Promise<readonly PublicQuestion[]>;
  publishedCount(): Promise<number>;
  publishedBySlug(slug: string): Promise<PublicQuestion | undefined>;
  prune(cutoffs: RetentionCutoffs, limit: number): Promise<number>;
  writeBatch(request: QuestionWriteRequest): QuestionWriteBatch;
  newSlug(): string;
}

const summaryRowSchema = z.object({
  id: z.string(),
  addressee: questionAddresseeSchema,
  status: questionStatusSchema,
  version: z.number().int(),
  received_on: z.string(),
});

const recordRowSchema = summaryRowSchema.extend({
  question_ciphertext: bytesSchema.nullable(),
  question_key_id: z.string().nullable(),
  draft_ciphertext: bytesSchema.nullable(),
  draft_key_id: z.string().nullable(),
  public_slug: z.string().nullable(),
  published_on: z.string().nullable(),
});

const publicRowSchema = z
  .object({
    public_slug: z.string(),
    addressee: z.string(),
    published_question: z.string(),
    published_answer: z.string(),
    published_on: z.string(),
  })
  .transform((row) =>
    publicQuestionSchema.parse({
      slug: row.public_slug,
      addressee: row.addressee,
      question: row.published_question,
      answer: row.published_answer,
      publishedOn: row.published_on,
    }),
  );

const countRowSchema = z.object({ total: z.number().int() });

function summaryOf(row: z.infer<typeof summaryRowSchema>): QuestionSummaryRecord {
  return {
    id: row.id,
    addressee: row.addressee,
    status: row.status,
    version: row.version,
    receivedOn: row.received_on,
  };
}

const sealedSchema = z.union([
  z.tuple([z.null(), z.null()]).transform(() => null),
  z
    .tuple([z.instanceof(Uint8Array), z.string()])
    .transform(([ciphertext, keyId]): SealedText => ({ ciphertext, keyId })),
]);

function sealed(ciphertext: Uint8Array | null, keyId: string | null): SealedText | null {
  return sealedSchema.parse([ciphertext, keyId]);
}

function recordOf(row: z.infer<typeof recordRowSchema>): QuestionRecord {
  return {
    ...summaryOf(row),
    question: sealed(row.question_ciphertext, row.question_key_id),
    draft: sealed(row.draft_ciphertext, row.draft_key_id),
    publicSlug: row.public_slug,
    publishedOn: row.published_on,
  };
}

async function receive(store: Store, arrival: QuestionArrival): Promise<boolean> {
  const { db } = store;
  const statement = db
    .prepare(INSERT_QUESTION)
    .bind(
      arrival.id,
      arrival.addressee,
      arrival.question.ciphertext,
      arrival.question.keyId,
      arrival.formKey,
      arrival.receivedOn,
    );
  return batchChanges(await db.batch([statement])).at(0) === 1;
}

export function questionsRepo(store: Store): QuestionsRepo {
  const { db } = store;
  return {
    receive: async (arrival) => receive(store, arrival),
    list: async ({ status, before, beforeId, limit }) => {
      const statement = db
        .prepare(LIST_QUESTIONS)
        .bind(status ?? null, before ?? null, beforeId ?? null, limit);
      return (await allRows(statement, summaryRowSchema)).map(summaryOf);
    },
    find: async (id) => {
      const row = await firstRow(db.prepare(SELECT_QUESTION).bind(id), recordRowSchema);
      return row === undefined ? undefined : recordOf(row);
    },
    published: async (limit, offset) =>
      allRows(db.prepare(LIST_PUBLISHED).bind(limit, offset), publicRowSchema),
    publishedCount: async () => {
      const rows = await allRows(db.prepare(COUNT_PUBLISHED), countRowSchema);
      return rows.reduce((total, row) => total + row.total, 0);
    },
    publishedBySlug: async (slug) =>
      firstRow(db.prepare(SELECT_PUBLISHED).bind(slug), publicRowSchema),
    prune: async (cutoffs, limit) => {
      const statement = db.prepare(PRUNE_QUESTIONS).bind(cutoffs.unanswered, cutoffs.closed, limit);
      return batchChanges(await db.batch([statement])).reduce((total, count) => total + count, 0);
    },
    writeBatch: (request) => questionWriteBatch(store, request),
    newSlug: () => publicSlug(store.random, QUESTION_SLUG_LENGTH),
  };
}
