import { richTextSchema } from "@zsm3/contracts/rich-text";

export const richTextSample = richTextSchema.parse([
  {
    type: "paragraph",
    content: [
      { type: "text", text: "Akapit z " },
      { type: "text", text: "pogrubieniem", marks: ["bold"] },
      { type: "text", text: ", " },
      { type: "text", text: "kursywą", marks: ["italic"] },
      { type: "text", text: " i linkiem do " },
      { type: "link", text: "rekrutacji", href: "/kandydaci/rekrutacja" },
      { type: "text", text: ". Edytor zapisuje strukturę, a nie HTML." },
    ],
  },
  { type: "heading", level: 2, text: "Nagłówek drugiego poziomu" },
  { type: "heading", level: 3, text: "Nagłówek trzeciego poziomu" },
  {
    type: "list",
    ordered: false,
    items: [[{ type: "text", text: "Lista punktowana" }], [{ type: "text", text: "Drugi punkt" }]],
  },
  {
    type: "list",
    ordered: true,
    items: [[{ type: "text", text: "Lista numerowana" }], [{ type: "text", text: "Drugi krok" }]],
  },
  {
    type: "quote",
    content: [{ type: "text", text: "Cytat wyróżniony pomarańczową linią." }],
    source: "Źródło cytatu",
  },
  {
    type: "table",
    caption: "Tabela z nagłówkami kolumn",
    header: ["Kolumna", "Wartość"],
    rows: [
      ["Pierwszy wiersz", "1"],
      ["Drugi wiersz", "2"],
    ],
  },
  { type: "video", provider: "youtube", id: "1zR5BuBQZcI", title: "Film prezentujący szkołę" },
]);
