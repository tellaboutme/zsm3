import { z } from "zod";

import { linkFileSchema, shortCodeSchema, targetUrlSchema } from "./short-links.ts";

export const panelShortLinkItemSchema = z
  .strictObject({
    code: shortCodeSchema,
    target: targetUrlSchema.nullable(),
    file: linkFileSchema.nullable(),
    createdAt: z.string(),
    expiresAt: z.string(),
    revokedAt: z.string().nullable(),
    clicks: z.int().nonnegative(),
    passwordProtected: z.boolean(),
  })
  .refine((item) => (item.target === null) !== (item.file === null), {
    message: "A link points to a target or to a file",
  });
export type PanelShortLinkItem = z.infer<typeof panelShortLinkItemSchema>;
export const panelShortLinkCreatedSchema = z.strictObject({ item: panelShortLinkItemSchema });
export const panelShortLinkCursorSchema = z.strictObject({
  createdAt: z.iso.datetime({ precision: 3 }),
  code: shortCodeSchema,
});
export type PanelShortLinkCursor = z.infer<typeof panelShortLinkCursorSchema>;
export const panelShortLinksQuerySchema = z
  .strictObject({
    limit: z
      .string()
      .regex(/^\d+$/u)
      .transform(Number)
      .pipe(z.int().min(1).max(200))
      .prefault("50"),
    beforeCreatedAt: panelShortLinkCursorSchema.shape.createdAt.optional(),
    beforeCode: shortCodeSchema.optional(),
  })
  .refine((query) => (query.beforeCreatedAt === undefined) === (query.beforeCode === undefined), {
    message: "Cursor fields must be provided together",
  });
export const panelShortLinksListSchema = z.strictObject({
  items: z.array(panelShortLinkItemSchema).max(200),
  nextCursor: panelShortLinkCursorSchema.nullable(),
});
