import { questionDraftSchema, type QuestionDraft } from "@zsm3/contracts/questions";
import type { Context } from "hono";
import { z } from "zod";

import { requirePanelDeps, type PanelDeps } from "./deps.ts";
import type { AppEnv } from "../../app-env.ts";
import { unseal } from "../../questions/sealing.ts";
import type { QuestionRecord } from "../../storage/questions-repo.ts";

export const QUESTIONS_ENTITY = "questions";

export async function openDraft(
  deps: PanelDeps,
  record: QuestionRecord,
): Promise<QuestionDraft | null> {
  if (record.draft === null) {
    return null;
  }
  const plaintext = await unseal(deps.piiCrypto, "draft", record.id, record.draft);
  return questionDraftSchema.parse(JSON.parse(plaintext));
}

export async function openQuestion(
  deps: PanelDeps,
  record: QuestionRecord,
): Promise<string | null> {
  return record.question === null
    ? null
    : unseal(deps.piiCrypto, "question", record.id, record.question);
}

export async function findQuestion(c: Context<AppEnv>): Promise<QuestionRecord | undefined> {
  const id = z.uuid().safeParse(c.req.param("id"));
  return id.success ? requirePanelDeps(c).repos.questions.find(id.data) : undefined;
}
