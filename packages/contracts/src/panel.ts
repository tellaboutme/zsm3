import { z } from "zod";

import { announcementInputSchema } from "./announcements.ts";
import { bellScheduleSchema } from "./bells.ts";
import {
  contentPageSchema,
  newsSchema,
  publicationStatusSchema,
  redirectSchema,
  schoolEventSchema,
  sitePathSchema,
} from "./content.ts";
import { panelDatasetSaveSchema } from "./datasets.ts";
import { storedFileSchema } from "./media.ts";
import { panelRevisionRestoreSchema } from "./revisions.ts";

export const PANEL_LIST_PAGE_SIZE = 20;
export const MAX_PANEL_PAGE_SIZE = 50;
export const MAX_SCHOOL_YEAR_EVENTS = 400;

const clampedInteger = (min: number, max: number, fallback: number) =>
  z.coerce
    .number()
    .refine(Number.isFinite, { message: "Value must be a finite number" })
    .transform((value) => Math.min(Math.max(Math.trunc(value), min), max))
    .default(fallback);

const panelPageSize = z.coerce
  .number()
  .refine(Number.isFinite, { message: "Value must be a finite number" })
  .transform((value) => Math.min(Math.max(Math.trunc(value), 1), MAX_PANEL_PAGE_SIZE))
  .default(PANEL_LIST_PAGE_SIZE);

export const panelListQuerySchema = z.strictObject({
  page: clampedInteger(1, 10_000, 1),
  pageSize: panelPageSize,
  status: z.enum(["draft", "published", "all"]).default("all"),
  category: z.string().trim().min(1).max(80).optional(),
  year: z
    .string()
    .trim()
    .regex(/^\d{4}$/u, { message: "Year must be four digits" })
    .optional(),
});

export type PanelListQuery = z.infer<typeof panelListQuerySchema>;

export const schoolYearParamSchema = z
  .string()
  .regex(/^\d{4}$/u, { message: "School year anchor must be four digits" })
  .transform(Number)
  .pipe(z.int().min(1000).max(2999));

export function schoolYearRange(startYear: number): readonly [string, string] {
  return [`${String(startYear)}-08-01`, `${String(startYear + 1)}-07-31`];
}

export function schoolYearLabel(startYear: number): string {
  return `${String(startYear)}/${String(startYear + 1)}`;
}

export const panelNewsItemSchema = newsSchema.extend({ status: publicationStatusSchema });
export type PanelNewsItem = z.infer<typeof panelNewsItemSchema>;
export const panelNewsListSchema = z.strictObject({
  items: z.array(panelNewsItemSchema),
  total: z.int().min(0),
  page: z.int().min(1),
  pageSize: z.int().min(1).max(MAX_PANEL_PAGE_SIZE),
});
export const panelNewsViewSchema = z.strictObject({ item: panelNewsItemSchema });

export const panelNewsMutationSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("save"), item: newsSchema }),
  z.strictObject({ action: z.literal("publish") }),
  z.strictObject({ action: z.literal("unpublish") }),
]);

export const panelPageListItemSchema = z.strictObject({
  path: sitePathSchema,
  status: publicationStatusSchema,
  title: z.string().min(1).max(200),
});
export const panelPageListSchema = z.strictObject({ items: z.array(panelPageListItemSchema) });
export const panelPageItemSchema = contentPageSchema.extend({ status: publicationStatusSchema });
export const panelPageViewSchema = z.strictObject({ item: panelPageItemSchema });

export const panelEventListSchema = z.strictObject({
  items: z.array(schoolEventSchema).max(MAX_SCHOOL_YEAR_EVENTS),
});
export const EMPTY_SCHOOL_YEAR_EVENTS = 0;
export const panelEventSaveSchema = z.strictObject({
  events: z
    .array(schoolEventSchema)
    .min(EMPTY_SCHOOL_YEAR_EVENTS)
    .max(MAX_SCHOOL_YEAR_EVENTS)
    .describe("Lower bound of zero lets an empty list clear the whole school year"),
});

export const panelFileListSchema = z.strictObject({ items: z.array(storedFileSchema) });
export const panelFileViewSchema = z.strictObject({ item: storedFileSchema });

export const panelRedirectListSchema = z.strictObject({ items: z.array(redirectSchema) });

export const panelStaffRoleSchema = z.enum(["admin", "secretariat", "editor", "gallery_editor"]);
export type PanelStaffRole = z.infer<typeof panelStaffRoleSchema>;
export const panelMeSchema = z.strictObject({
  email: z.string().trim().toLowerCase().min(1),
  role: panelStaffRoleSchema,
});

export const panelStaffEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(320)
  .regex(/^[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)+$/u);
export const panelStaffMemberSchema = z.strictObject({
  email: panelStaffEmailSchema,
  role: panelStaffRoleSchema,
  active: z.boolean(),
});
export type PanelStaffMember = z.infer<typeof panelStaffMemberSchema>;
export const panelStaffListSchema = z.strictObject({
  items: z.array(panelStaffMemberSchema.extend({ updatedAt: z.string() })),
});

export const panelRedirectFromSchema = z
  .string()
  .max(500)
  .regex(/^\/\S*$/u);

export const panelMutationSchema = z.discriminatedUnion("entity", [
  z.strictObject({ entity: z.literal("news"), mutation: panelNewsMutationSchema }),
  z.strictObject({
    entity: z.literal("pages"),
    action: z.literal("save"),
    page: contentPageSchema,
    status: publicationStatusSchema,
  }),
  z.strictObject({ entity: z.literal("events"), events: panelEventSaveSchema.shape.events }),
  z.strictObject({ entity: z.literal("redirects"), item: redirectSchema }),
  z.strictObject({ entity: z.literal("staff"), item: panelStaffMemberSchema }),
  z.strictObject({ entity: z.literal("announcements"), item: announcementInputSchema }),
  z.strictObject({ entity: z.literal("bells"), schedule: bellScheduleSchema }),
  panelRevisionRestoreSchema,
  panelDatasetSaveSchema,
]);

export type PanelMutation = z.infer<typeof panelMutationSchema>;

export const panelOkSchema = z.strictObject({ ok: z.literal(true) });

export const panelRouteNames = [
  "me",
  "news.list",
  "news.get",
  "news.create",
  "news.update",
  "news.publish",
  "pages.list",
  "pages.get",
  "pages.save",
  "events.get",
  "events.save",
  "files.list",
  "files.upload",
  "redirects.list",
  "redirects.save",
  "redirects.delete",
  "staff.list",
  "staff.save",
  "announcements.list",
  "announcements.create",
  "announcements.update",
  "announcements.delete",
  "bells.get",
  "bells.save",
  "revisions.list",
  "revisions.restore",
  "audit.list",
  "datasets.get",
  "datasets.save",
] as const;

export type PanelRouteName = (typeof panelRouteNames)[number];

export const panelRouteNameSchema = z.enum(panelRouteNames);
