import { z } from "zod";

import {
  contentPageSchema,
  newsSchema,
  publicationStatusSchema,
  sitePathSchema,
} from "./content.ts";
import { contentRevisionSchema, expectedRevisionSchema } from "./revisions.ts";

export const panelNewsItemSchema = newsSchema.extend({ status: publicationStatusSchema });
export type PanelNewsItem = z.infer<typeof panelNewsItemSchema>;
export const panelNewsViewSchema = z.strictObject({
  item: panelNewsItemSchema,
  revision: contentRevisionSchema,
});

export const panelNewsMutationSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("save"),
    item: newsSchema,
    expectedRevision: expectedRevisionSchema,
  }),
  z.strictObject({ action: z.literal("publish"), expectedRevision: contentRevisionSchema }),
  z.strictObject({ action: z.literal("unpublish"), expectedRevision: contentRevisionSchema }),
]);

export const panelPageListItemSchema = z.strictObject({
  path: sitePathSchema,
  status: publicationStatusSchema,
  title: z.string().min(1).max(200),
});
export const panelPageListSchema = z.strictObject({ items: z.array(panelPageListItemSchema) });
export const panelPageItemSchema = contentPageSchema.extend({ status: publicationStatusSchema });
export const panelPageViewSchema = z.strictObject({
  item: panelPageItemSchema,
  revision: contentRevisionSchema,
});
export const panelPageSaveSchema = z.strictObject({
  entity: z.literal("pages"),
  action: z.literal("save"),
  page: contentPageSchema,
  status: publicationStatusSchema,
  expectedRevision: expectedRevisionSchema,
});
