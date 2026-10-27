import { z } from "zod";

import { sitePathSchema, slugSchema } from "./content.ts";

const line = (max: number): z.ZodString => z.string().trim().min(1).max(max);

const SITE_LINK =
  /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?(?:#[a-z0-9-]+)?$/u;
const HTTPS_URL = /^https:\/\/[^\s"'<>\\]+$/u;

export const navLinkSchema = z.strictObject({
  label: line(120),
  href: z
    .string()
    .max(500)
    .refine((href) => SITE_LINK.test(href) || HTTPS_URL.test(href), {
      message: "A link points to a site path, a fragment of one, or an https address",
    }),
  external: z.literal(true).optional(),
});

export const navGroupSchema = z.strictObject({
  title: line(120),
  links: z.array(navLinkSchema).max(20),
});

export const featuredSchema = z.enum(["professions", "live-status", "next-meeting", "patron"]);

export const navSectionSchema = z.strictObject({
  id: slugSchema.max(40),
  label: line(40),
  href: sitePathSchema,
  groups: z.array(navGroupSchema).max(4),
  featured: featuredSchema.optional(),
});

export const navigationSchema = z.strictObject({
  sections: z.array(navSectionSchema).min(1).max(8),
  utilityLinks: z.array(navLinkSchema).max(8),
  footerGroups: z.array(navGroupSchema).max(6),
});

export type NavLink = z.infer<typeof navLinkSchema>;
export type NavGroup = z.infer<typeof navGroupSchema>;
export type NavSection = z.infer<typeof navSectionSchema>;
export type Navigation = z.infer<typeof navigationSchema>;
