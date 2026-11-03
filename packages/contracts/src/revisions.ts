import { z } from "zod";

import { publicationStatusSchema } from "./content.ts";

export const MAX_LISTED_REVISIONS = 50;
export const contentRevisionSchema = z.int().min(0).max(Number.MAX_SAFE_INTEGER);
export const expectedRevisionSchema = contentRevisionSchema.nullable();
export const panelSavedSchema = z.strictObject({
  ok: z.literal(true),
  revision: contentRevisionSchema,
});
export type PanelSaved = z.infer<typeof panelSavedSchema>;
export const revisionTargetSchema = z.enum(["news", "pages", "datasets"]);
export type RevisionTarget = z.infer<typeof revisionTargetSchema>;
export const panelRevisionListSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        revision: z.int().min(1),
        at: z.string().min(1),
        actorEmail: z.string().nullable(),
        title: z.string(),
        status: publicationStatusSchema,
      }),
    )
    .max(MAX_LISTED_REVISIONS),
});
export const panelRevisionRestoreSchema = z.strictObject({
  entity: z.literal("revisions"),
  target: revisionTargetSchema,
  id: z.string().min(1).max(300),
  revision: z.int().min(1),
  expectedRevision: contentRevisionSchema,
});
export type PanelRevisionRestore = z.infer<typeof panelRevisionRestoreSchema>;
