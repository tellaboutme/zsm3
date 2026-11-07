import { questionSlugSchema, type PublicQuestion } from "@zsm3/contracts/questions";
import { liveStore } from "@zsm3/worker/storage/database.ts";
import { questionsRepo } from "@zsm3/worker/storage/questions-repo.ts";
import { env } from "cloudflare:workers";

import { boxAvailability, QUESTIONS_PAGE_SIZE, type BoxAvailability } from "../lib/questions.ts";

export interface QuestionsPage {
  readonly items: readonly PublicQuestion[];
  readonly total: number;
}

export function questionBox(): BoxAvailability {
  return boxAvailability(env.SKRZYNKA_ENABLED, env.TURNSTILE_SITE_KEY);
}

export async function publishedQuestions(page: number): Promise<QuestionsPage> {
  const repo = questionsRepo(liveStore(env.DB));
  const [items, total] = await Promise.all([
    repo.published(QUESTIONS_PAGE_SIZE, (page - 1) * QUESTIONS_PAGE_SIZE),
    repo.publishedCount(),
  ]);
  return { items, total };
}

export async function publishedQuestion(
  slug: string | undefined,
): Promise<PublicQuestion | undefined> {
  const parsed = questionSlugSchema.safeParse(slug);
  return parsed.success ? questionsRepo(liveStore(env.DB)).publishedBySlug(parsed.data) : undefined;
}
