import {
  panelQuestionDecisionSchema,
  panelQuestionDraftSaveSchema,
  publishableDraftSchema,
  type QuestionDecision,
} from "@zsm3/contracts/questions";
import type { Context } from "hono";

import { auditEntry } from "./audit.ts";
import { requirePanelDeps, requirePanelSession, type PanelDeps } from "./deps.ts";
import { parseJsonBody } from "./http.ts";
import { findQuestion, openDraft, QUESTIONS_ENTITY } from "./question-reads.ts";
import type { AppEnv } from "../../app-env.ts";
import { canChange, type QuestionChange } from "../../domain/question-lifecycle.ts";
import { problemResponse } from "../../http/problem.ts";
import { seal } from "../../questions/sealing.ts";
import { batchChanges } from "../../storage/database.ts";
import type { QuestionRecord } from "../../storage/questions-repo.ts";
import type { QuestionWrite } from "../../storage/questions-writes.ts";

const CHANGED = "Question Changed";
const NOT_ALLOWED = "Invalid Question Transition";
const ANSWER_REQUIRED = "Answer Required";

const AUDIT_FIELDS: Readonly<Record<QuestionChange, readonly string[]>> = {
  draft: ["draft"],
  publish: ["status", "published"],
  reject: ["status"],
  withdraw: ["status", "published"],
  delete: ["question"],
};

async function commit(
  c: Context<AppEnv>,
  record: QuestionRecord,
  change: QuestionChange,
  write: QuestionWrite,
): Promise<Response> {
  const deps = requirePanelDeps(c);
  const batch = deps.repos.questions.writeBatch({
    id: record.id,
    expectedVersion: record.version,
    write,
    audit: auditEntry({
      session: requirePanelSession(c),
      action: `questions.${change}`,
      entity: QUESTIONS_ENTITY,
      entityId: record.id,
      fields: AUDIT_FIELDS[change],
    }),
  });
  if (!batch.applied(batchChanges(await deps.db.batch([...batch.statements])))) {
    return problemResponse(c, 409, CHANGED);
  }
  return c.json({ ok: true, version: change === "delete" ? null : record.version + 1 });
}

async function guarded(
  c: Context<AppEnv>,
  expectedVersion: number,
  change: QuestionChange,
): Promise<QuestionRecord | Response> {
  const record = await findQuestion(c);
  if (record === undefined) {
    return problemResponse(c, 404);
  }
  if (record.version !== expectedVersion) {
    return problemResponse(c, 409, CHANGED);
  }
  if (!canChange(change, record.status)) {
    return problemResponse(c, 422, NOT_ALLOWED);
  }
  return record;
}

export async function saveQuestionDraft(c: Context<AppEnv>): Promise<Response> {
  const body = await parseJsonBody(c, panelQuestionDraftSaveSchema);
  if (body === undefined) {
    return problemResponse(c, 422);
  }
  const record = await guarded(c, body.expectedVersion, "draft");
  if (record instanceof Response) {
    return record;
  }
  const plaintext = JSON.stringify({ question: body.question, answer: body.answer });
  const draft = await seal(requirePanelDeps(c).piiCrypto, "draft", record.id, plaintext);
  return commit(c, record, "draft", { kind: "draft", draft });
}

async function publication(
  deps: PanelDeps,
  record: QuestionRecord,
): Promise<QuestionWrite | undefined> {
  const draft = publishableDraftSchema.safeParse(await openDraft(deps, record));
  if (!draft.success) {
    return undefined;
  }
  return {
    kind: "publish",
    question: draft.data.question,
    answer: draft.data.answer,
    slug: record.publicSlug ?? deps.repos.questions.newSlug(),
  };
}

async function decisionWrite(
  deps: PanelDeps,
  record: QuestionRecord,
  action: QuestionDecision,
): Promise<QuestionWrite | undefined> {
  switch (action) {
    case "publish":
      return publication(deps, record);
    case "reject":
      return { kind: "reject" };
    case "withdraw":
      return { kind: "withdraw" };
    case "delete":
      return { kind: "delete" };
  }
}

export async function decideQuestion(c: Context<AppEnv>): Promise<Response> {
  const body = await parseJsonBody(c, panelQuestionDecisionSchema);
  if (body === undefined) {
    return problemResponse(c, 422);
  }
  const record = await guarded(c, body.expectedVersion, body.action);
  if (record instanceof Response) {
    return record;
  }
  const write = await decisionWrite(requirePanelDeps(c), record, body.action);
  if (write === undefined) {
    return problemResponse(c, 422, ANSWER_REQUIRED);
  }
  return commit(c, record, body.action, write);
}
