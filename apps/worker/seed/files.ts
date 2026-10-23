import {
  mediaKey,
  mediaFormatSchema,
  mediaPath,
  sha256Schema,
  type FileLink,
  type StoredFile,
} from "@zsm3/contracts/media";
import { z } from "zod";

import manifest from "./files.json" with { type: "json" };

const seedFileSchema = z.strictObject({
  name: z.string().min(1).max(200),
  format: mediaFormatSchema,
  sha256: sha256Schema,
  bytes: z.int().min(1),
});

export type SeedFile = z.infer<typeof seedFileSchema>;

export const seedFiles: Readonly<Record<string, SeedFile>> = z
  .record(z.string().regex(/^[a-z0-9-]+$/u), seedFileSchema)
  .parse(manifest);

export function seedFile(id: string): SeedFile {
  const file = seedFiles[id];
  if (file === undefined) {
    throw new Error(`Unknown seed file ${id}`);
  }
  return file;
}

export function storedFile(file: SeedFile): StoredFile {
  return {
    key: mediaKey(file.sha256, file.format),
    name: file.name,
    format: file.format,
    bytes: file.bytes,
  };
}

export function fileLink(id: string, title: string, description?: string): FileLink {
  const file = seedFile(id);
  return {
    title,
    ...(description === undefined ? {} : { description }),
    href: mediaPath(mediaKey(file.sha256, file.format)),
    format: file.format,
    bytes: file.bytes,
  };
}
