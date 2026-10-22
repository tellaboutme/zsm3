import { z } from "zod";

const SAFE_HREF =
  /^(?:https:\/\/[^\s"'<>\\]+|\/(?!\/)[^\s"'<>\\]*|#[\w-]+|mailto:[^\s@"'<>]+@[^\s@"'<>]+|tel:\+?\d[\d ]{2,19})$/u;
const YOUTUBE_ID = /^[\w-]{11}$/u;
const MAX_COLUMNS = 8;

const shortText = z.string().trim().min(1).max(200);
const cell = z.string().trim().min(1).max(500);

export const markSchema = z.enum(["bold", "italic"]);

export const textSchema = z.strictObject({
  type: z.literal("text"),
  text: z.string().min(1).max(5000),
  marks: z.array(markSchema).max(2).optional(),
});

export const linkSchema = z.strictObject({
  type: z.literal("link"),
  text: z.string().trim().min(1).max(500),
  href: z.string().max(2000).regex(SAFE_HREF),
});

export const inlineSchema = z.union([textSchema, linkSchema]);

const inlines = z.array(inlineSchema).min(1).max(200);

export const paragraphSchema = z.strictObject({
  type: z.literal("paragraph"),
  content: inlines,
});

export const headingSchema = z.strictObject({
  type: z.literal("heading"),
  level: z.union([z.literal(2), z.literal(3)]),
  text: shortText,
});

export const listSchema = z.strictObject({
  type: z.literal("list"),
  ordered: z.boolean(),
  items: z.array(inlines).min(1).max(100),
});

export const quoteSchema = z.strictObject({
  type: z.literal("quote"),
  content: inlines,
  source: shortText.optional(),
});

export const tableSchema = z
  .strictObject({
    type: z.literal("table"),
    caption: shortText,
    header: z.array(cell).min(1).max(MAX_COLUMNS),
    rows: z.array(z.array(cell).min(1).max(MAX_COLUMNS)).min(1).max(100),
  })
  .refine((table) => table.rows.every((row) => row.length === table.header.length), {
    message: "Every row needs one cell per column",
    path: ["rows"],
  });

export const videoSchema = z.strictObject({
  type: z.literal("video"),
  provider: z.literal("youtube"),
  id: z.string().regex(YOUTUBE_ID),
  title: shortText,
});

export const blockSchema = z.union([
  paragraphSchema,
  headingSchema,
  listSchema,
  quoteSchema,
  tableSchema,
  videoSchema,
]);

export const richTextSchema = z.array(blockSchema).min(1).max(500);

export type Inline = z.infer<typeof inlineSchema>;
export type Block = z.infer<typeof blockSchema>;
export type RichText = z.infer<typeof richTextSchema>;

function inlineText(content: readonly Inline[]): string {
  return content.map((inline) => inline.text).join("");
}

function blockText(block: Block): string {
  switch (block.type) {
    case "paragraph":
    case "quote":
      return inlineText(block.content);
    case "heading":
      return block.text;
    case "video":
      return block.title;
    case "list":
      return block.items.map(inlineText).join(" ");
    case "table":
      return [block.caption, ...block.header, ...block.rows.flat()].join(" ");
  }
}

export function plainText(document: RichText): string {
  return document.map(blockText).join(" ");
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}
