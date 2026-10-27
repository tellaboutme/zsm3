import type { RichText } from "@zsm3/contracts/rich-text";
import { it } from "vitest";

import {
  blockKindOf,
  blockLabels,
  blockKinds,
  draftFromFields,
  fieldValues,
  newBlock,
  withBlock,
  type BlockDraft,
} from "../src/lib/panel/blocks.ts";
import { insertedBlock, movedBlock, removedBlock } from "../src/lib/panel/blocks.ts";
import { drafts, invalidRows, toDocument } from "../src/lib/panel/document.ts";

const PARAGRAPH: BlockDraft = {
  kind: "paragraph",
  text: "Zajęcia w warsztacie.",
};

it("names every block kind in Polish", ({ expect }) => {
  expect([...blockKinds]).toEqual(["paragraph", "heading", "list", "quote", "table", "video"]);
  expect(blockLabels.table).toBe("Tabela");
});

it("fills defaults when form fields are absent", ({ expect }) => {
  expect(draftFromFields("paragraph", {})).toEqual({ kind: "paragraph", text: "" });
  expect(draftFromFields("heading", {})).toEqual({ kind: "heading", level: 2, text: "" });
  expect(draftFromFields("list", {})).toEqual({ kind: "list", ordered: false, items: "" });
  expect(draftFromFields("quote", {})).toEqual({ kind: "quote", text: "", source: "" });
  expect(draftFromFields("table", {})).toEqual({
    kind: "table",
    caption: "",
    header: "",
    rows: "",
  });
  expect(draftFromFields("video", {})).toEqual({ kind: "video", id: "", title: "" });
  expect(fieldValues(draftFromFields("list", {}))).toEqual({
    ordered: "false",
    items: "",
  });
});

it("maps unknown kinds onto the paragraph", ({ expect }) => {
  expect(blockKindOf("heading")).toBe("heading");
  expect(blockKindOf(undefined)).toBe("paragraph");
  expect(blockKindOf("film")).toBe("paragraph");
});

it("keeps moving safe when a row vanishes", ({ expect }) => {
  const sparse: BlockDraft[] = [PARAGRAPH];
  sparse.length = 3;
  expect(movedBlock(sparse, 1, 1)).toBe(sparse);
});

it("creates an empty draft per kind", ({ expect }) => {
  expect(newBlock("paragraph")).toEqual({ kind: "paragraph", text: "" });
  expect(newBlock("heading")).toEqual({ kind: "heading", level: 2, text: "" });
  expect(newBlock("list")).toEqual({ kind: "list", ordered: false, items: "" });
  expect(newBlock("quote")).toEqual({ kind: "quote", text: "", source: "" });
  expect(newBlock("table")).toEqual({ kind: "table", caption: "", header: "", rows: "" });
  expect(newBlock("video")).toEqual({ kind: "video", id: "", title: "" });
});

it("reads form fields into drafts and back", ({ expect }) => {
  const fields = { level: "3", text: "Godziny dyżurów" };
  const draft = draftFromFields("heading", fields);
  expect(draft).toEqual({ kind: "heading", level: 3, text: "Godziny dyżurów" });
  expect(fieldValues(draft)).toEqual({ level: "3", text: "Godziny dyżurów" });
  expect(fieldValues(draftFromFields("paragraph", { text: "A" }))).toEqual({ text: "A" });
  expect(fieldValues(draftFromFields("list", { ordered: "true", items: "a\nb" }))).toEqual({
    ordered: "true",
    items: "a\nb",
  });
  expect(fieldValues(draftFromFields("quote", { text: "T", source: "S" }))).toEqual({
    text: "T",
    source: "S",
  });
  expect(fieldValues(draftFromFields("table", { caption: "C", header: "H", rows: "R" }))).toEqual({
    caption: "C",
    header: "H",
    rows: "R",
  });
  expect(fieldValues(draftFromFields("video", { id: "dQw4w9WgXcQ", title: "Wideo" }))).toEqual({
    id: "dQw4w9WgXcQ",
    title: "Wideo",
  });
  expect(draftFromFields("heading", { level: "2", text: "" })).toEqual({
    kind: "heading",
    level: 2,
    text: "",
  });
});

it("serializes drafts into the rich text contract", ({ expect }) => {
  const result = toDocument([
    PARAGRAPH,
    { kind: "heading", level: 2, text: "Kalendarz" },
    { kind: "list", ordered: true, items: "Papierów\nKapcie" },
    { kind: "quote", text: "Nie ma", source: "dyrektor" },
    { kind: "table", caption: "Dyżury", header: "Sala | Godzina", rows: "21 | 08:00" },
    { kind: "video", id: "dQw4w9WgXcQ", title: "Open day" },
  ]);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.document).toMatchObject([
      { type: "paragraph", content: [{ type: "text", text: "Zajęcia w warsztacie." }] },
      { type: "heading", level: 2 },
      { type: "list", ordered: true },
      { type: "quote", source: "dyrektor" },
      { type: "table", header: ["Sala", "Godzina"], rows: [["21", "08:00"]] },
      { type: "video", provider: "youtube" },
    ]);
  }
});

it("omits the optional quote source", ({ expect }) => {
  const result = toDocument([{ kind: "quote", text: "Bez źródła", source: "" }]);
  if (result.ok) {
    expect(result.document[0]).toEqual({
      type: "quote",
      content: [{ type: "text", text: "Bez źródła" }],
    });
  } else {
    throw new Error("quote should validate");
  }
});

it("reports which blocks are incomplete", ({ expect }) => {
  const result = toDocument([{ kind: "paragraph", text: "" }]);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.issues).toEqual(["Blok 1 jest niepełny"]);
    expect(invalidRows([{ path: [1, "text"] }, { path: [3, "items"] }])).toEqual([
      "Blok 2 jest niepełny",
      "Blok 4 jest niepełny",
    ]);
    expect(invalidRows([{ path: "brak" }, { path: [true, "x"] }])).toEqual([]);
  }
});

it("drops tables without a header", ({ expect }) => {
  const result = toDocument([{ kind: "table", caption: "C", header: "", rows: "" }]);
  expect(result.ok).toBe(false);
});

it("round-trips a document through drafts", ({ expect }) => {
  const source: RichText = [
    { type: "paragraph", content: [{ type: "text", text: "Start" }] },
    { type: "heading", level: 3, text: "Sekcja" },
    {
      type: "list",
      ordered: false,
      items: [[{ type: "text", text: "Pierwszy" }], [{ type: "text", text: "Drugi" }]],
    },
    { type: "quote", content: [{ type: "text", text: "Cytat" }] },
    { type: "table", caption: "Godziny", header: ["Dzień"], rows: [["pon-czw"]] },
    { type: "video", provider: "youtube", id: "dQw4w9WgXcQ", title: "Dzień otwarty" },
  ];
  const final = toDocument(drafts(source));
  if (final.ok) {
    expect(final.document).toEqual(source);
  } else {
    throw new Error("round trip should validate");
  }
});

it("adds, moves and removes drafts inside bounds", ({ expect }) => {
  const rows: BlockDraft[] = [
    PARAGRAPH,
    { kind: "quote", text: "Q", source: "" },
    newBlock("video"),
  ];
  expect(withBlock(rows, 1, PARAGRAPH)).toEqual([PARAGRAPH, PARAGRAPH, newBlock("video")]);
  expect(withBlock(rows, 5, PARAGRAPH)).toBe(rows);
  expect(withBlock(rows, -1, PARAGRAPH)).toBe(rows);
  expect(removedBlock(rows, -1)).toBe(rows);
  expect(movedBlock(rows, 0, 1)).toEqual([rows[1], rows[0], rows[2]]);
  expect(movedBlock(rows, 2, 1)).toBe(rows);
  expect(movedBlock(rows, 0, -1)).toBe(rows);
  expect(removedBlock(rows, 0)).toEqual([rows[1], rows[2]]);
  expect(removedBlock(rows, 9)).toBe(rows);
  expect(insertedBlock(rows, -5, "table")[0]).toEqual(newBlock("table"));
  expect(insertedBlock(rows, 99, "table")[3]).toEqual(newBlock("table"));
  expect(insertedBlock(rows, 1, "heading")).toEqual([
    rows[0],
    { kind: "heading", level: 2, text: "" },
    rows[1],
    rows[2],
  ]);
});
