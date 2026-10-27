export const blockKinds = ["paragraph", "heading", "list", "quote", "table", "video"] as const;

export type BlockKind = (typeof blockKinds)[number];

export const blockLabels: Readonly<Record<BlockKind, string>> = {
  paragraph: "Akapit",
  heading: "Nagłówek",
  list: "Lista",
  quote: "Cytat",
  table: "Tabela",
  video: "Wideo",
};

export type BlockDraft =
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "heading"; readonly level: 2 | 3; readonly text: string }
  | { readonly kind: "list"; readonly ordered: boolean; readonly items: string }
  | { readonly kind: "quote"; readonly text: string; readonly source: string }
  | {
      readonly kind: "table";
      readonly caption: string;
      readonly header: string;
      readonly rows: string;
    }
  | { readonly kind: "video"; readonly id: string; readonly title: string };

export type Fields = Readonly<Record<string, string>>;

export function blockKindOf(value: string | undefined): BlockKind {
  return blockKinds.find((kind) => kind === value) ?? "paragraph";
}

export function newBlock(kind: BlockKind): BlockDraft {
  switch (kind) {
    case "paragraph":
      return { kind, text: "" };
    case "heading":
      return { kind, level: 2, text: "" };
    case "list":
      return { kind, ordered: false, items: "" };
    case "quote":
      return { kind, text: "", source: "" };
    case "table":
      return { kind, caption: "", header: "", rows: "" };
    case "video":
      return { kind, id: "", title: "" };
  }
}

export type Maker = (fields: Fields) => BlockDraft;

export const MAKERS: Readonly<Record<BlockKind, Maker>> = {
  paragraph: (fields) => ({ kind: "paragraph", text: fields["text"] ?? "" }),
  heading: (fields) => ({
    kind: "heading",
    level: fields["level"] === "3" ? 3 : 2,
    text: fields["text"] ?? "",
  }),
  list: (fields) => ({
    kind: "list",
    ordered: fields["ordered"] === "true",
    items: fields["items"] ?? "",
  }),
  quote: (fields) => ({
    kind: "quote",
    text: fields["text"] ?? "",
    source: fields["source"] ?? "",
  }),
  table: (fields) => ({
    kind: "table",
    caption: fields["caption"] ?? "",
    header: fields["header"] ?? "",
    rows: fields["rows"] ?? "",
  }),
  video: (fields) => ({ kind: "video", id: fields["id"] ?? "", title: fields["title"] ?? "" }),
};

export function draftFromFields(kind: BlockKind, fields: Fields): BlockDraft {
  return MAKERS[kind](fields);
}

export function fieldValues(draft: BlockDraft): Fields {
  switch (draft.kind) {
    case "paragraph":
      return { text: draft.text };
    case "heading":
      return { level: String(draft.level), text: draft.text };
    case "list":
      return { ordered: draft.ordered ? "true" : "false", items: draft.items };
    case "quote":
      return { text: draft.text, source: draft.source };
    case "table":
      return { caption: draft.caption, header: draft.header, rows: draft.rows };
    case "video":
      return { id: draft.id, title: draft.title };
  }
}

export function withBlock(
  rows: readonly BlockDraft[],
  index: number,
  draft: BlockDraft,
): readonly BlockDraft[] {
  if (index < 0 || index >= rows.length) {
    return rows;
  }
  return rows.map((value, position) => (position === index ? draft : value));
}

export function removedBlock(rows: readonly BlockDraft[], index: number): readonly BlockDraft[] {
  if (index < 0 || index >= rows.length) {
    return rows;
  }
  return rows.toSpliced(index, 1);
}

export function movedBlock(
  rows: readonly BlockDraft[],
  index: number,
  delta: -1 | 1,
): readonly BlockDraft[] {
  const target = index + delta;
  const draft = rows[index];
  if (index < 0 || target < 0 || index >= rows.length || target >= rows.length) {
    return rows;
  }
  if (draft === undefined) {
    return rows;
  }
  return rows.toSpliced(index, 1).toSpliced(target, 0, draft);
}

export function insertedBlock(
  rows: readonly BlockDraft[],
  index: number,
  kind: BlockKind,
): readonly BlockDraft[] {
  const target = Math.min(Math.max(index, 0), rows.length);
  return rows.toSpliced(target, 0, newBlock(kind));
}
