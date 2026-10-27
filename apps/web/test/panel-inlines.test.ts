import type { Inline, RichText } from "@zsm3/contracts/rich-text";
import { it } from "vitest";

import { drafts, toDocument } from "../src/lib/panel/document.ts";
import { encodeInlines, parseInlines } from "../src/lib/panel/inlines.ts";

const OPENING: { readonly type: "paragraph"; readonly content: Inline[] } = {
  type: "paragraph",
  content: [
    { type: "text", text: "Witajcie " },
    { type: "text", text: "ciepło", marks: ["bold", "italic"] },
    { type: "text", text: " w " },
    { type: "link", text: "bibliotece", href: "https://biblioteka.zsm3.edu.pl" },
    { type: "text", text: "!" },
  ],
};

const PARAGRAPH: RichText = [OPENING];

const DOCUMENT: RichText = [
  ...PARAGRAPH,
  {
    type: "list",
    ordered: true,
    items: [
      [{ type: "text", text: "Zbiórka", marks: ["italic"] }],
      [{ type: "link", text: "plan", href: "/kalendarz" }],
      [{ type: "text", text: "Moc: 2**3 z [nawiasem]" }],
    ],
  },
];

it("carries bold, italic and links into the draft markup", ({ expect }) => {
  expect(drafts(PARAGRAPH)[0]).toEqual({
    kind: "paragraph",
    text: "Witajcie ***ciepło*** w [bibliotece](https://biblioteka.zsm3.edu.pl)!",
  });
});

it("keeps a document identical across load and save", ({ expect }) => {
  expect(drafts(DOCUMENT)[1]).toEqual({
    kind: "list",
    ordered: true,
    items: "__Zbiórka__\n[plan](/kalendarz)\nMoc: 2\\*\\*3 z \\[nawiasem]",
  });
  const final = toDocument(drafts(DOCUMENT));
  expect(final.ok).toBe(true);
  if (final.ok) {
    expect(final.document).toEqual(DOCUMENT);
  }
});

it("keeps marks when staff edit the run text in place", ({ expect }) => {
  const result = toDocument([
    {
      kind: "paragraph",
      text: "**Dzień otwarty __rozszerzony__** i [dzisiaj](https://zsm3.edu.pl)",
    },
  ]);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.document).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Dzień otwarty __rozszerzony__", marks: ["bold"] },
          { type: "text", text: " i " },
          { type: "link", text: "dzisiaj", href: "https://zsm3.edu.pl" },
        ],
      },
    ]);
  }
});

it("canonicalizes the mark pair order regardless of input order", ({ expect }) => {
  const result = toDocument([{ kind: "paragraph", text: "***raz***" }]);
  if (result.ok) {
    expect(result.document).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "raz", marks: ["bold", "italic"] }],
      },
    ]);
  } else {
    throw new Error("paragraph should validate");
  }
  expect(
    drafts([
      { type: "paragraph", content: [{ type: "text", text: "x", marks: ["italic", "bold"] }] },
    ]),
  ).toEqual([{ kind: "paragraph", text: "***x***" }]);
});

it("writes markup that always parses back", ({ expect }) => {
  const encoded = encodeInlines(OPENING.content);
  expect(parseInlines(encoded)).toEqual(OPENING.content);
});

it("treats unclosed markup as literal text", ({ expect }) => {
  const result = toDocument([{ kind: "paragraph", text: "Tak jest **zjawiskowo prawda" }]);
  if (result.ok) {
    expect(result.document).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Tak jest **zjawiskowo prawda" }] },
    ]);
  } else {
    throw new Error("paragraph should validate");
  }
});

it("parses the markup grammar directly", ({ expect }) => {
  expect(parseInlines("Tak **jest** dalej")).toEqual([
    { type: "text", text: "Tak " },
    { type: "text", text: "jest", marks: ["bold"] },
    { type: "text", text: " dalej" },
  ]);
  expect(parseInlines("[link](https://x.pl)")).toEqual([
    { type: "link", text: "link", href: "https://x.pl" },
  ]);
  expect(parseInlines("***")).toBeUndefined();
  expect(parseInlines("**pół")).toBeUndefined();
  expect(parseInlines("[zero](")).toBeUndefined();
  expect(parseInlines("[nic]()")).toBeUndefined();
  expect(parseInlines("[](https://x.pl)")).toBeUndefined();
  expect(parseInlines("")).toBeUndefined();
  expect(encodeInlines(OPENING.content)).toBe(
    "Witajcie ***ciepło*** w [bibliotece](https://biblioteka.zsm3.edu.pl)!",
  );
  expect(encodeInlines([{ type: "link", text: "a]b)(", href: "https://x/(y)" }])).toBe(
    "[a\\]b)(](https://x/(y\\))",
  );
});

it("carries backslash runs and links with escapes", ({ expect }) => {
  const runs: readonly Inline[] = [
    { type: "text", text: "A\\B" },
    { type: "link", text: "x\\y", href: "https://x.pl/a)" },
  ];
  expect(parseInlines(encodeInlines(runs))).toEqual(runs);
  expect(parseInlines("[raz dwa]")).toBeUndefined();
  expect(parseInlines("____")).toBeUndefined();
});

it("escapes newlines inside runs so list lines stay separable", ({ expect }) => {
  const source: RichText = [
    { type: "paragraph", content: [{ type: "text", text: "Linia\nDalsza" }] },
    { type: "list", ordered: false, items: [[{ type: "text", text: "Krok\nJeden" }]] },
  ];
  expect(drafts(source)[1]).toEqual({ kind: "list", ordered: false, items: "Krok\\nJeden" });
  const final = toDocument(drafts(source));
  if (final.ok) {
    expect(final.document).toEqual(source);
  } else {
    throw new Error("document should validate");
  }
});
