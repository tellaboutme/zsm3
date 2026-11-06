import { questionDraftSchema, type QuestionDraft } from "@zsm3/contracts/questions";
import type { Context } from "hono";
import { z } from "zod";

import { requirePanelDeps, type PanelDeps } from "./deps.ts";
import type { AppEnv } from "../../app-env.ts";
import { logEvent } from "../../logging/log.ts";
import { unseal, type SealPurpose } from "../../questions/sealing.ts";
import { PiiDecryptionError, type PiiCrypto } from "../../security/pii-crypto.ts";
import type { QuestionRecord, SealedText } from "../../storage/questions-repo.ts";

export const QUESTIONS_ENTITY = "questions";

export type Opened<T> =
  { readonly readable: true; readonly value: T | null } | { readonly readable: false };

export async function openSealed(
  crypto: PiiCrypto,
  part: SealPurpose,
  id: string,
  sealed: SealedText | null,
): Promise<Opened<string>> {
  if (sealed === null) {
    return { readable: true, value: null };
  }
  try {
    return { readable: true, value: await unseal(crypto, part, id, sealed) };
  } catch (error) {
    if (!(error instanceof PiiDecryptionError)) {
      throw error;
    }
    logEvent({ event: "question_unreadable", part, keyId: sealed.keyId });
    return { readable: false };
  }
}

export async function openDraft(
  deps: PanelDeps,
  record: QuestionRecord,
): Promise<Opened<QuestionDraft>> {
  const draft = await openSealed(deps.piiCrypto, "draft", record.id, record.draft);
  if (!draft.readable || draft.value === null) {
    return draft.readable ? { readable: true, value: null } : draft;
  }
  return { readable: true, value: questionDraftSchema.parse(JSON.parse(draft.value)) };
}

export async function openQuestion(
  deps: PanelDeps,
  record: QuestionRecord,
): Promise<Opened<string>> {
  return openSealed(deps.piiCrypto, "question", record.id, record.question);
}

export function valueOf<T>(content: Opened<T>): T | null {
  return content.readable ? content.value : null;
}

export async function findQuestion(c: Context<AppEnv>): Promise<QuestionRecord | undefined> {
  const id = z.uuid().safeParse(c.req.param("id"));
  return id.success ? requirePanelDeps(c).repos.questions.find(id.data) : undefined;
}
