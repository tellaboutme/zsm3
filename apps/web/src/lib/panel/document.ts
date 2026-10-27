import { richTextSchema, type Block, type Inline, type RichText } from "@zsm3/contracts/rich-text";

import type { BlockDraft } from "./blocks.ts";
import { encodeInlines, parseInlines } from "./inlines.ts";

export type BlocksResult =
  | { readonly ok: true; readonly document: RichText }
  | { readonly ok: false; readonly issues: readonly string[] };

function textInline(text: string): Inline {
  return { type: "text", text };
}

function runsOf(source: string): readonly Inline[] {
  const parsed = parseInlines(source);
  return parsed ?? [textInline(source)];
}

export function joinLines(value: string): readonly string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function cells(line: string): readonly string[] {
  return line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
}

export function draftToBlock(draft: BlockDraft): readonly Block[] {
  switch (draft.kind) {
    case "paragraph":
      return [{ type: "paragraph", content: [...runsOf(draft.text)] }];
    case "heading":
      return [{ type: "heading", level: draft.level, text: draft.text }];
    case "list": {
      const items = joinLines(draft.items).map((item) => [...runsOf(item)]);
      return [{ type: "list", ordered: draft.ordered, items }];
    }
    case "quote": {
      const content = [...runsOf(draft.text)];
      return draft.source.length === 0
        ? [{ type: "quote", content }]
        : [{ type: "quote", content, source: draft.source }];
    }
    case "table": {
      const header = [...cells(draft.header)];
      if (header.length === 0) {
        return [];
      }
      const rows = joinLines(draft.rows).map((line) => [...cells(line)]);
      return [{ type: "table", caption: draft.caption, header, rows }];
    }
    case "video":
      return [{ type: "video", provider: "youtube", id: draft.id, title: draft.title }];
  }
}

export function toDocument(blockDrafts: readonly BlockDraft[]): BlocksResult {
  const blocks = blockDrafts.flatMap(draftToBlock);
  const parsed = richTextSchema.safeParse(blocks);
  if (parsed.success) {
    return { ok: true, document: parsed.data };
  }
  return { ok: false, issues: invalidRows(parsed.error.issues) };
}

function segmentsOf(path: unknown): readonly unknown[] {
  return path instanceof Array ? path : [];
}

function rowPositions(blocks: readonly { readonly path: unknown }[]): readonly number[] {
  const positions = new Set<number>();
  for (const issue of blocks) {
    for (const segment of segmentsOf(issue.path)) {
      if (typeof segment === "number") {
        positions.add(segment);
      }
    }
  }
  return [...positions];
}

export function invalidRows(problems: readonly { readonly path: unknown }[]): readonly string[] {
  const sorted = rowPositions(problems).toSorted((a, b) => a - b);
  return sorted.map((position) => `Blok ${String(position + 1)} jest niepełny`);
}

export function drafts(document: RichText): readonly BlockDraft[] {
  return document.flatMap(draftOf);
}

function draftOf(block: Block): readonly BlockDraft[] {
  switch (block.type) {
    case "paragraph":
      return [{ kind: "paragraph", text: encodeInlines(block.content) }];
    case "heading":
      return [{ kind: "heading", level: block.level, text: block.text }];
    case "list":
      return [
        {
          kind: "list",
          ordered: block.ordered,
          items: block.items.map(encodeInlines).join("\n"),
        },
      ];
    case "quote":
      return [
        {
          kind: "quote",
          text: encodeInlines(block.content),
          source: block.source ?? "",
        },
      ];
    case "table":
      return [
        {
          kind: "table",
          caption: block.caption,
          header: block.header.join(" | "),
          rows: block.rows.map((row) => row.join(" | ")).join("\n"),
        },
      ];
    case "video":
      return [{ kind: "video", id: block.id, title: block.title }];
  }
}
