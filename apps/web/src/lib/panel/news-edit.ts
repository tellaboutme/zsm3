import { newsSchema, type News } from "@zsm3/contracts/content";

import type { BlockDraft } from "./blocks.ts";
import { toDocument } from "./document.ts";
import { validationPhrases } from "./validation.ts";

export interface NewsCandidate {
  readonly ok: boolean;
  readonly item: News | undefined;
  readonly issues: readonly string[];
}

function coverOf(
  fields: Readonly<Record<string, string>>,
): { caption: string } | { caption: string; credit: string } | undefined {
  const caption = (fields["caption"] ?? "").trim();
  if (caption.length === 0) {
    return undefined;
  }
  const credit = (fields["credit"] ?? "").trim();
  if (credit.length === 0) {
    return { caption };
  }
  return { caption, credit };
}

function itemOf(fields: Readonly<Record<string, string>>, body: News["body"]): News {
  const sketch = {
    slug: (fields["slug"] ?? "").trim(),
    date: fields["date"] ?? "",
    category: (fields["category"] ?? "").trim(),
    title: (fields["title"] ?? "").trim(),
    lead: (fields["lead"] ?? "").trim(),
    body,
  };
  const cover = coverOf(fields);
  if (cover === undefined) {
    return sketch;
  }
  return { ...sketch, cover };
}

export function newsCandidate(
  fields: Readonly<Record<string, string>>,
  blocks: readonly BlockDraft[],
): NewsCandidate {
  const document = toDocument(blocks);
  if (!document.ok) {
    return { ok: false, item: undefined, issues: document.issues };
  }
  const parsed = newsSchema.safeParse(itemOf(fields, document.document));
  if (!parsed.success) {
    return { ok: false, item: undefined, issues: validationPhrases(parsed.error.issues) };
  }
  return { ok: true, item: parsed.data, issues: [] };
}
