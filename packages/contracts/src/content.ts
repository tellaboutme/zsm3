import { z } from "zod";

import { richTextSchema } from "./rich-text.ts";

const MAX_SECTIONS = 20;
const MAX_ITEMS = 40;

export const isoDateSchema = z.iso.date();

export const slugSchema = z
  .string()
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

export const sitePathSchema = z
  .string()
  .max(300)
  .regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/u);

const line = (max: number): z.ZodString => z.string().trim().min(1).max(max);

export const newsSchema = z.strictObject({
  slug: slugSchema,
  date: isoDateSchema,
  category: line(80),
  title: line(200),
  lead: line(500),
  body: richTextSchema,
  cover: z.strictObject({ caption: line(300), credit: line(120).optional() }).optional(),
});

export const audienceSchema = z.enum(["Wszyscy", "Uczniowie", "Rodzice"]);

export const eventKindSchema = z.enum([
  "rok-szkolny",
  "przerwa",
  "wolne",
  "zebranie",
  "uroczystosc",
  "oceny",
  "egzamin",
  "praktyki",
]);

export const schoolEventSchema = z
  .strictObject({
    date: isoDateSchema,
    endDate: isoDateSchema.optional(),
    title: line(200),
    audience: audienceSchema,
    kind: eventKindSchema,
    note: line(300).optional(),
    key: z.literal(true).optional(),
  })
  .refine((event) => event.endDate === undefined || event.endDate > event.date, {
    message: "The end date must be after the start date",
    path: ["endDate"],
  });

const factSchema = z.strictObject({ value: line(40), label: line(120) });

const linkSchema = z.strictObject({ label: line(120), href: sitePathSchema });

export const contentBlockSchema = z.union([
  z.strictObject({ type: z.literal("rich-text"), document: richTextSchema }),
  z.strictObject({
    type: z.literal("facts"),
    label: line(120),
    facts: z.array(factSchema).min(1).max(8),
  }),
  z.strictObject({
    type: z.literal("timeline"),
    items: z
      .array(z.strictObject({ label: line(40), title: line(200), text: line(600) }))
      .min(1)
      .max(MAX_ITEMS),
  }),
  z.strictObject({
    type: z.literal("callout"),
    title: line(200),
    text: line(600),
    link: linkSchema.optional(),
  }),
]);

export const contentPageSchema = z.strictObject({
  path: sitePathSchema.refine((path) => path.split("/").length === 3, {
    message: "Content pages live one level below a section",
  }),
  kicker: line(120),
  title: line(200),
  intro: line(600),
  sections: z
    .array(
      z.strictObject({
        id: slugSchema,
        title: line(200),
        blocks: z.array(contentBlockSchema).min(1).max(MAX_ITEMS),
      }),
    )
    .min(1)
    .max(MAX_SECTIONS),
});

export const redirectSchema = z
  .strictObject({
    from: z
      .string()
      .regex(/^\/\S*$/u)
      .max(500),
    to: sitePathSchema,
  })
  .refine((redirect) => redirect.from !== redirect.to, {
    message: "A redirect cannot point to itself",
    path: ["to"],
  });

export const publicationStatusSchema = z.enum(["draft", "published"]);

export type News = z.infer<typeof newsSchema>;
export type SchoolEvent = z.infer<typeof schoolEventSchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type ContentPage = z.infer<typeof contentPageSchema>;
export type Redirect = z.infer<typeof redirectSchema>;
export type PublicationStatus = z.infer<typeof publicationStatusSchema>;
