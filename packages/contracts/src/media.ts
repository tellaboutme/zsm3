import { z } from "zod";

export const mediaFormats = ["pdf", "docx", "xlsx", "odt", "zip", "7z", "jpg", "png"] as const;

export const mediaFormatSchema = z.enum(mediaFormats);

export type MediaFormat = z.infer<typeof mediaFormatSchema>;

export const mediaContentTypes: Readonly<Record<MediaFormat, string>> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt: "application/vnd.oasis.opendocument.text",
  zip: "application/zip",
  "7z": "application/x-7z-compressed",
  jpg: "image/jpeg",
  png: "image/png",
};

export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);

export const mediaKeySchema = z
  .string()
  .regex(/^d\/[0-9a-f]{64}\.(?:pdf|docx|xlsx|odt|zip|7z|jpg|png)$/u);

export const mediaPathSchema = z
  .string()
  .regex(/^\/media\/d\/[0-9a-f]{64}\.(?:pdf|docx|xlsx|odt|zip|7z|jpg|png)$/u);

export function mediaKey(sha256: string, format: MediaFormat): string {
  return `d/${sha256}.${format}`;
}

export function mediaPath(key: string): string {
  return `/media/${key}`;
}

const line = (max: number): z.ZodString => z.string().trim().min(1).max(max);

export const storedFileSchema = z.strictObject({
  key: mediaKeySchema,
  name: line(200),
  format: mediaFormatSchema,
  bytes: z.int().min(1).max(MAX_FILE_BYTES),
});

export const fileLinkSchema = z.strictObject({
  title: line(200),
  description: line(300).optional(),
  href: mediaPathSchema,
  format: mediaFormatSchema,
  bytes: z.int().min(1).max(MAX_FILE_BYTES),
});

export const filesBlockSchema = z.strictObject({
  type: z.literal("files"),
  label: line(120),
  files: z.array(fileLinkSchema).min(1).max(60),
});

export type StoredFile = z.infer<typeof storedFileSchema>;
export type FileLink = z.infer<typeof fileLinkSchema>;
export type FilesBlock = z.infer<typeof filesBlockSchema>;
