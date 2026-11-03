import { z } from "zod";

export const CODE_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";
export const CODE_LENGTH = 7;
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 200;
export const MAX_TARGET_LENGTH = 2000;
export const MAX_LINK_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_LINK_FILE_NAME_LENGTH = 160;

export const shortCodeSchema = z
  .string()
  .length(CODE_LENGTH)
  .regex(/^[2-9a-kmnp-z]+$/u);

export const targetUrlSchema = z
  .url()
  .max(MAX_TARGET_LENGTH)
  .regex(/^https:\/\/[^\s/?#]\S*$/u);

export const linkPasswordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH);

export const newShortLinkSchema = z.strictObject({
  target: targetUrlSchema,
  password: linkPasswordSchema.optional(),
});

export const linkFileFormats = ["pdf", "docx", "xlsx", "pptx", "odt", "ods", "odp"] as const;

export const linkFileFormatSchema = z.enum(linkFileFormats);

export type LinkFileFormat = z.infer<typeof linkFileFormatSchema>;

export const linkFileContentTypes: Readonly<Record<LinkFileFormat, string>> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
};

export const linkFileNameSchema = z.string().min(1).max(MAX_LINK_FILE_NAME_LENGTH);

export const linkFileSchema = z.strictObject({
  name: linkFileNameSchema,
  format: linkFileFormatSchema,
  bytes: z.int().min(1).max(MAX_LINK_FILE_BYTES),
});

export type ShortCode = z.infer<typeof shortCodeSchema>;
export type NewShortLink = z.infer<typeof newShortLinkSchema>;
export type LinkFile = z.infer<typeof linkFileSchema>;
