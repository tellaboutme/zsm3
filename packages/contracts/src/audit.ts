import { z } from "zod";

export const AUDIT_PAGE_SIZE = 50;

export const auditCursorSchema = z
  .string()
  .max(200)
  .regex(/^[0-9TZ:.-]{1,40}\|[0-9a-f-]{1,40}$/u);

export const panelAuditListSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        at: z.string().min(1),
        actorEmail: z.string().nullable(),
        action: z.string().min(1),
        entity: z.string().min(1),
        entityId: z.string().min(1),
        fields: z.array(z.string()),
      }),
    )
    .max(AUDIT_PAGE_SIZE),
  next: auditCursorSchema.nullable(),
});

export type PanelAuditList = z.infer<typeof panelAuditListSchema>;
