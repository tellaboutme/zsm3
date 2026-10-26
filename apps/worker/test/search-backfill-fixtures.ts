export const newsBody = [
  {
    type: "paragraph",
    content: [
      { type: "text", text: "Samo", marks: ["bold"] },
      { type: "link", text: "loty", href: "/szkola" },
    ],
  },
  { type: "heading", level: 2, text: "Pracownia silników" },
  { type: "list", ordered: false, items: [[{ type: "link", text: "Przegląd", href: "/szkola" }]] },
  { type: "quote", content: [{ type: "text", text: "Badania" }], source: "Źródło" },
  { type: "table", caption: "Pomiary", header: ["Element"], rows: [["Wirnik"]] },
  { type: "video", provider: "youtube", id: "abcdefghijk", title: "Film instruktażowy" },
];

export const pageSections = [
  {
    id: "lotnictwo",
    title: "Lotnictwo",
    blocks: [
      { type: "callout", title: "Warsztaty", text: "Silniki samolotów" },
      {
        type: "rich-text",
        document: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Samo", marks: ["italic"] },
              { type: "text", text: "loty" },
            ],
          },
          { type: "table", caption: "Zestawienie", header: ["Część"], rows: [["Turbina"]] },
          { type: "video", provider: "youtube", id: "abcdefghijk", title: "Nagranie pracowni" },
        ],
      },
      { type: "facts", label: "Wyposażenie", facts: [{ value: "4", label: "Stanowiska" }] },
      { type: "timeline", items: [{ label: "Etap", title: "Montaż", text: "Kontrola" }] },
      {
        type: "files",
        label: "Materiały",
        files: [
          {
            title: "Instrukcja",
            description: "Schemat",
            href: `/media/d/${"a".repeat(64)}.pdf`,
            format: "pdf",
            bytes: 100,
          },
        ],
      },
    ],
  },
];
