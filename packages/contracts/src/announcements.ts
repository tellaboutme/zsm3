import { z } from "zod";

import { isoDateSchema, sitePathSchema } from "./content.ts";

export const MAX_ANNOUNCEMENTS = 200;

const HTTPS_URL = /^https:\/\/[^\s"'<>\\]+$/u;

export const announcementSeveritySchema = z.enum(["info", "important", "urgent"]);

export const announcementLinkSchema = z.strictObject({
  label: z.string().trim().min(1).max(80),
  href: z.union([sitePathSchema, z.string().max(500).regex(HTTPS_URL)]),
});

const announcementFields = {
  severity: announcementSeveritySchema,
  text: z.string().trim().min(1).max(300),
  link: announcementLinkSchema.optional(),
  startsOn: isoDateSchema,
  endsOn: isoDateSchema,
};

const endsAfterStart = (item: { readonly startsOn: string; readonly endsOn: string }): boolean =>
  item.endsOn >= item.startsOn;

const endsAfterStartIssue = { message: "The last day cannot precede the first", path: ["endsOn"] };

export const announcementInputSchema = z
  .strictObject(announcementFields)
  .refine(endsAfterStart, endsAfterStartIssue);

export const announcementSchema = z
  .strictObject({ id: z.uuid(), updatedAt: z.string().min(1), ...announcementFields })
  .refine(endsAfterStart, endsAfterStartIssue);

export const announcementListSchema = z.strictObject({
  items: z.array(announcementSchema).max(MAX_ANNOUNCEMENTS),
});

export type AnnouncementSeverity = z.infer<typeof announcementSeveritySchema>;
export type AnnouncementInput = z.infer<typeof announcementInputSchema>;
export type StoredAnnouncement = z.infer<typeof announcementSchema>;
