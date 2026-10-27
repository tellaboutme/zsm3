import { contentPageSchema, type ContentBlock, type ContentPage } from "@zsm3/contracts/content";

import type { BlockDraft } from "./blocks.ts";
import { drafts, toDocument } from "./document.ts";
import { validationPhrases } from "./validation.ts";

export type SectionRow =
  | { readonly rich: true; readonly drafts: readonly BlockDraft[] }
  | { readonly rich: false; readonly block: ContentBlock; readonly label: string };

export interface SectionDraft {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly SectionRow[];
}

export interface PageDraft {
  readonly path: string;
  readonly kicker: string;
  readonly title: string;
  readonly intro: string;
  readonly status: "draft" | "published";
  readonly sections: readonly SectionDraft[];
}

export interface PageCandidate {
  readonly ok: boolean;
  readonly page: ContentPage | undefined;
  readonly issues: readonly string[];
}

type ContentPageSection = ContentPage["sections"][number];

const BLOCK_LABELS: Readonly<Record<string, string>> = {
  facts: "Liczby",
  timeline: "Oś czasu",
  callout: "Wyróżnienie",
  files: "Pliki",
};

export function keptLabel(type: string): string {
  return BLOCK_LABELS[type] ?? "Blok";
}

function rowFor(block: ContentBlock): SectionRow {
  if (block.type === "rich-text") {
    return { rich: true, drafts: drafts(block.document) };
  }
  return { rich: false, block, label: keptLabel(block.type) };
}

export function pageDrafts(page: ContentPage, status: "draft" | "published"): PageDraft {
  const sections: SectionDraft[] = [];
  for (const section of page.sections) {
    const rows: SectionRow[] = [];
    for (const block of section.blocks) {
      rows.push(rowFor(block));
    }
    sections.push({ id: section.id, title: section.title, rows });
  }
  return { ...page, status, sections };
}

export function emptySection(index: number): SectionDraft {
  return { id: `sekcja-${String(index + 1)}`, title: "", rows: [{ rich: true, drafts: [] }] };
}

export function newPageDraft(path: string): PageDraft {
  return {
    path,
    kicker: "",
    title: "",
    intro: "",
    status: "draft",
    sections: [emptySection(0)],
  };
}

function sectionBlocks(rows: readonly SectionRow[]): readonly ContentBlock[] | undefined {
  const blocks: ContentBlock[] = [];
  for (const row of rows) {
    if (row.rich) {
      const result = toDocument(row.drafts);
      if (!result.ok) {
        return undefined;
      }
      blocks.push({ type: "rich-text", document: result.document });
    } else {
      blocks.push(row.block);
    }
  }
  return blocks;
}

export function sectionCandidates(
  draft: PageDraft,
  fields: Readonly<Record<string, string>>,
): readonly ContentPageSection[] | undefined {
  const sections: ContentPageSection[] = [];
  for (const [index, section] of draft.sections.entries()) {
    const blocks = sectionBlocks(section.rows);
    if (blocks === undefined) {
      return undefined;
    }
    sections.push({
      id: fields[`section-${String(index)}-id`]?.trim() ?? section.id,
      title: fields[`section-${String(index)}-title`]?.trim() ?? section.title,
      blocks: [...blocks],
    });
  }
  return sections;
}

export function pageCandidate(
  draft: PageDraft,
  fields: Readonly<Record<string, string>>,
): PageCandidate {
  const sections = sectionCandidates(draft, fields);
  if (sections === undefined) {
    return { ok: false, page: undefined, issues: ["Sekcja ma niepełny blok tekstu"] };
  }
  const candidate = {
    path: fields["path"] ?? draft.path,
    kicker: fields["kicker"] ?? draft.kicker,
    title: fields["title"] ?? draft.title,
    intro: fields["intro"] ?? draft.intro,
    sections,
  };
  const parsed = contentPageSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, page: undefined, issues: validationPhrases(parsed.error.issues) };
  }
  return { ok: true, page: parsed.data, issues: [] };
}
