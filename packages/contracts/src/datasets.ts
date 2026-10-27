import { z } from "zod";

import { isoDateSchema, sitePathSchema, slugSchema } from "./content.ts";
import { navigationSchema } from "./navigation.ts";
import { programmesSchema } from "./programmes.ts";

const line = (max: number): z.ZodString => z.string().trim().min(1).max(max);
const list = <T extends z.ZodType>(item: T, max: number): z.ZodArray<T> => z.array(item).max(max);

const HTTPS_URL = /^https:\/\/[^\s"'<>\\]+$/u;
const MEDIA_FILE = /^\/media\/d\/[0-9a-f]{64}\.[a-z0-9]{2,4}$/u;
const PHONE = /^\+\d{6,15}(?:,\d{1,6})?$/u;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export const mediaFileSchema = z.strictObject({
  href: z.string().regex(MEDIA_FILE),
  bytes: z.int().min(1).max(104_857_600),
});

export const staffDirectorySchema = list(
  z.strictObject({
    id: slugSchema.max(60),
    title: line(120),
    summary: line(300),
    subjects: list(line(120), 20),
    people: list(
      z.strictObject({
        name: line(120).optional(),
        role: line(120),
        subjects: line(300).optional(),
      }),
      120,
    ),
  }),
  30,
);

export const meetingsSchema = z.strictObject({
  date: isoDateSchema,
  order: line(300),
  steps: list(z.strictObject({ time: z.string().regex(TIME), text: line(300) }), 12),
  grades: list(
    z.strictObject({
      grade: line(60),
      classes: list(z.strictObject({ name: line(20), room: line(20) }), 20),
    }),
    8,
  ),
});

const contactCardSchema = z.strictObject({
  title: line(120),
  role: line(200),
  phones: list(z.strictObject({ number: z.string().regex(PHONE), label: line(60) }), 6),
  emails: list(z.email().max(200), 6),
});

export const contactsSchema = z.strictObject({
  departments: list(contactCardSchema, 20),
  management: list(contactCardSchema, 20),
});

export const signerSchema = z.enum(["uczen", "rodzic", "kazdy"]);

export const documentsSchema = list(
  z.strictObject({
    id: slugSchema.max(60),
    title: line(120),
    summary: line(300),
    documents: list(
      z.strictObject({
        code: line(12),
        title: line(200),
        description: line(400),
        signer: signerSchema,
        ...mediaFileSchema.shape,
        updated: isoDateSchema,
      }),
      60,
    ),
  }),
  20,
);

export const partnersSchema = list(
  z.strictObject({
    name: line(120),
    role: line(200),
    href: z.union([sitePathSchema, z.string().max(500).regex(HTTPS_URL)]).optional(),
  }),
  20,
);

export const jobOffersSchema = list(
  z.strictObject({
    employer: line(160),
    position: line(160),
    description: line(600).optional(),
    validUntil: isoDateSchema,
    file: mediaFileSchema.optional(),
  }),
  200,
);

export const datasetSchemas = {
  kadra: staffDirectorySchema,
  wywiadowki: meetingsSchema,
  kontakty: contactsSchema,
  dokumenty: documentsSchema,
  partnerzy: partnersSchema,
  "oferty-pracy": jobOffersSchema,
  kierunki: programmesSchema,
  nawigacja: navigationSchema,
} as const;

export type DatasetKey = keyof typeof datasetSchemas;

export const datasetKeySchema = z.enum([
  "kadra",
  "wywiadowki",
  "kontakty",
  "dokumenty",
  "partnerzy",
  "oferty-pracy",
  "kierunki",
  "nawigacja",
]);

export type StaffDirectory = z.infer<typeof staffDirectorySchema>;
export type Meetings = z.infer<typeof meetingsSchema>;
export type Contacts = z.infer<typeof contactsSchema>;
export type DocumentGroups = z.infer<typeof documentsSchema>;
export type Partners = z.infer<typeof partnersSchema>;
export type JobOffers = z.infer<typeof jobOffersSchema>;
export type DatasetValue<K extends DatasetKey> = z.infer<(typeof datasetSchemas)[K]>;

export const panelDatasetViewSchema = z.strictObject({
  key: datasetKeySchema,
  data: z.unknown(),
  updatedAt: z.string().min(1),
});

export const panelDatasetSaveSchema = z.strictObject({
  entity: z.literal("datasets"),
  key: datasetKeySchema,
  data: z.unknown(),
});

export type PanelDatasetSave = z.infer<typeof panelDatasetSaveSchema>;
