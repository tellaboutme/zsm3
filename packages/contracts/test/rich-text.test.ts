import { describe, it } from "vitest";

import { plainText, richTextSchema, youtubeWatchUrl } from "../src/rich-text.ts";

const paragraph = (href: string): unknown => [
  { type: "paragraph", content: [{ type: "link", text: "Link", href }] },
];

const fullDocument = [
  { type: "heading", level: 2, text: "Harmonogram" },
  {
    type: "paragraph",
    content: [
      { type: "text", text: "Uroczystość ", marks: ["bold"] },
      { type: "text", text: "szkolna ", marks: ["italic"] },
      { type: "link", text: "terminarz", href: "/szkola/terminarz" },
    ],
  },
  {
    type: "list",
    ordered: true,
    items: [[{ type: "text", text: "Apel" }], [{ type: "text", text: "Spektakl" }]],
  },
  { type: "quote", content: [{ type: "text", text: "Cytat" }], source: "Autor" },
  {
    type: "table",
    caption: "Plan",
    header: ["Godzina", "Punkt"],
    rows: [
      ["10:00", "Apel"],
      ["10:20", "Spektakl"],
    ],
  },
  { type: "video", provider: "youtube", id: "1zR5BuBQZcI", title: "Film o szkole" },
];

describe("rich text allow-list", () => {
  it("accepts every supported block", ({ expect }) => {
    expect(richTextSchema.safeParse(fullDocument).success).toBe(true);
  });

  it("accepts safe link targets", ({ expect }) => {
    for (const href of [
      "https://www.bip.krakow.pl/?bip_id=269",
      "/kandydaci/rekrutacja",
      "/",
      "#harmonogram",
      "mailto:s@zespolszkolmechanicznych.edu.pl",
      "mailto:sekretariat@zsm3.pl",
      "tel:+48126440689",
      "tel:12 644 06 89",
    ]) {
      expect(richTextSchema.safeParse(paragraph(href)).success, href).toBe(true);
    }
  });

  it("rejects scripts, protocol-relative links and markup in link targets", ({ expect }) => {
    for (const href of [
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox",
      "http://example.com",
      "//example.com",
      'https://example.com/"onmouseover=x',
      "https://exa mple.com",
      "/path<script>",
      "mailto:nobody",
      "tel:abc",
      "tel:1",
      " https://example.com",
      "",
    ]) {
      expect(richTextSchema.safeParse(paragraph(href)).success, href).toBe(false);
    }
  });

  it("rejects unknown blocks, unknown keys and raw HTML containers", ({ expect }) => {
    for (const document of [
      [{ type: "html", html: "<script>alert(1)</script>" }],
      [{ type: "paragraph", content: [{ type: "text", text: "x" }], html: "<b>x</b>" }],
      [{ type: "paragraph", content: [{ type: "text", text: "x", style: "color:red" }] }],
      [{ type: "paragraph", content: [{ type: "image", src: "x.png" }] }],
      [{ type: "heading", level: 1, text: "Title" }],
      [{ type: "heading", level: 4, text: "Title" }],
      [{ type: "paragraph", content: [{ type: "text", text: "x", marks: ["underline"] }] }],
      [{ type: "video", provider: "vimeo", id: "1zR5BuBQZcI", title: "Film" }],
      [{ type: "video", provider: "youtube", id: "1zR5BuBQZc", title: "Film" }],
      [{ type: "video", provider: "youtube", id: '1zR5BuBQZc"', title: "Film" }],
      [{ type: "video", provider: "youtube", id: "1zR5BuBQZcII", title: "Film" }],
      [],
      [{ type: "paragraph", content: [] }],
      [{ type: "heading", level: 2, text: "   " }],
      [{ type: "paragraph", content: [{ type: "link", text: "   ", href: "/" }] }],
      [{ type: "table", caption: "Plan", header: ["A"], rows: [["   "]] }],
    ]) {
      expect(richTextSchema.safeParse(document).success, JSON.stringify(document)).toBe(false);
    }
  });

  it("requires one cell per column in every table row", ({ expect }) => {
    const table = (rows: string[][]): unknown => [
      { type: "table", caption: "Plan", header: ["A", "B"], rows },
    ];

    expect(richTextSchema.safeParse(table([["1", "2"]])).success).toBe(true);
    expect(richTextSchema.safeParse(table([["1"]])).success).toBe(false);
    expect(richTextSchema.safeParse(table([["1", "2", "3"]])).success).toBe(false);
    expect(richTextSchema.safeParse(table([["1", "2"], ["1"]])).success).toBe(false);
    const issues = richTextSchema.safeParse(table([["1"]])).error?.issues;

    expect(issues?.[0]?.message).toBe("Every row needs one cell per column");
    expect(issues?.[0]?.path).toEqual([0, "rows"]);
  });

  it("limits the size of a document", ({ expect }) => {
    const text = (length: number): unknown => [
      { type: "paragraph", content: [{ type: "text", text: "a".repeat(length) }] },
    ];
    const columns = (count: number): unknown => [
      {
        type: "table",
        caption: "Plan",
        header: Array.from({ length: count }, () => "A"),
        rows: [Array.from({ length: count }, () => "1")],
      },
    ];

    expect(richTextSchema.safeParse(text(5000)).success).toBe(true);
    expect(richTextSchema.safeParse(text(5001)).success).toBe(false);
    expect(richTextSchema.safeParse(columns(8)).success).toBe(true);
    expect(richTextSchema.safeParse(columns(9)).success).toBe(false);
  });
});

describe("rich text helpers", () => {
  it("extracts plain text for descriptions and search", ({ expect }) => {
    const document = richTextSchema.parse(fullDocument);

    expect(plainText(document)).toBe(
      "Harmonogram Uroczystość szkolna terminarz Apel Spektakl Cytat Plan Godzina Punkt 10:00 Apel 10:20 Spektakl Film o szkole",
    );
  });

  it("links a video to YouTube", ({ expect }) => {
    expect(youtubeWatchUrl("1zR5BuBQZcI")).toBe("https://www.youtube.com/watch?v=1zR5BuBQZcI");
    expect(youtubeWatchUrl("a&b")).toBe("https://www.youtube.com/watch?v=a%26b");
  });
});
