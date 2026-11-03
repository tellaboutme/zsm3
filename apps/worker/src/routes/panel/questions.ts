import {
  PANEL_QUESTIONS_PAGE,
  panelQuestionDetailSchema,
  panelQuestionsListSchema,
  panelQuestionsQuerySchema,
} from "@zsm3/contracts/questions";
import { Hono, type Context } from "hono";

import { requirePanelDeps } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { uniqueQuery } from "./http.ts";
import { findQuestion, openDraft, openQuestion, QUESTIONS_ENTITY } from "./question-reads.ts";
import { decideQuestion, saveQuestionDraft } from "./question-writes.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import type { QuestionSummaryRecord } from "../../storage/questions-repo.ts";

const HISTORY_LIMIT = 50;

function summaryOf(record: QuestionSummaryRecord) {
  return {
    id: record.id,
    addressee: record.addressee,
    status: record.status,
    version: record.version,
    receivedOn: record.receivedOn,
  };
}

async function listQuestions(c: Context<AppEnv>): Promise<Response> {
  const query = panelQuestionsQuerySchema.safeParse(uniqueQuery(c));
  if (!query.success) {
    return problemResponse(c, 422);
  }
  const rows = await requirePanelDeps(c).repos.questions.list({
    ...query.data,
    limit: PANEL_QUESTIONS_PAGE + 1,
  });
  const items = rows.slice(0, PANEL_QUESTIONS_PAGE);
  const last = rows.length > PANEL_QUESTIONS_PAGE ? items.at(-1) : undefined;
  return c.json(
    panelQuestionsListSchema.parse({
      items: items.map(summaryOf),
      nextBefore: last?.receivedOn ?? null,
      nextBeforeId: last?.id ?? null,
    }),
  );
}

async function showQuestion(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const record = await findQuestion(c);
  if (record === undefined) {
    return problemResponse(c, 404);
  }
  const history = await deps.repos.audit.byEntity(QUESTIONS_ENTITY, record.id, HISTORY_LIMIT);
  return c.json(
    panelQuestionDetailSchema.parse({
      ...summaryOf(record),
      question: await openQuestion(deps, record),
      draft: await openDraft(deps, record),
      published:
        record.status === "published"
          ? { slug: record.publicSlug, publishedOn: record.publishedOn }
          : null,
      history: history.map((entry) => ({
        at: entry.at,
        action: entry.action,
        actorEmail: entry.actorEmail,
      })),
    }),
  );
}

export function questionsRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/questions", panelGuard("questions.list"), listQuestions)
    .get("/questions/:id", panelGuard("questions.get"), showQuestion)
    .put("/questions/:id/draft", panelGuard("questions.draft"), panelJsonOrigin, saveQuestionDraft)
    .post(
      "/questions/:id/decision",
      panelGuard("questions.decide"),
      panelJsonOrigin,
      decideQuestion,
    );
}
