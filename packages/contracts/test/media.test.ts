import { describe, it } from "vitest";

import {
  fileLinkSchema,
  filesBlockSchema,
  MAX_FILE_BYTES,
  mediaContentTypes,
  mediaFormats,
  mediaKey,
  mediaKeySchema,
  mediaPath,
  mediaPathSchema,
  sha256Schema,
  storedFileSchema,
} from "../src/media.ts";

const hash = "0123456789abcdef".repeat(4);

describe("media keys and paths", () => {
  it("builds keys and public paths from a content hash", ({ expect }) => {
    const key = mediaKey(hash, "pdf");

    expect(key).toBe(`d/${hash}.pdf`);
    expect(mediaPath(key)).toBe(`/media/d/${hash}.pdf`);
    expect(mediaKeySchema.safeParse(key).success).toBe(true);
    expect(mediaPathSchema.safeParse(mediaPath(key)).success).toBe(true);
  });

  it("accepts only lower-case SHA-256 hashes and known formats", ({ expect }) => {
    expect(sha256Schema.safeParse(hash).success).toBe(true);
    expect(sha256Schema.safeParse(hash.toUpperCase()).success).toBe(false);
    expect(sha256Schema.safeParse(hash.slice(1)).success).toBe(false);
    expect(mediaKeySchema.safeParse(`d/${hash}.exe`).success).toBe(false);
    expect(mediaKeySchema.safeParse(`g/${hash}.pdf`).success).toBe(false);
    expect(mediaKeySchema.safeParse(`d/${hash}.pdf/x`).success).toBe(false);
    expect(mediaPathSchema.safeParse(`/media/d/${hash}.pdf?x`).success).toBe(false);
    expect(mediaPathSchema.safeParse(`https://example.com/media/d/${hash}.pdf`).success).toBe(
      false,
    );
  });

  it("knows a content type for every format", ({ expect }) => {
    expect(Object.keys(mediaContentTypes)).toEqual([...mediaFormats]);
    expect(mediaContentTypes.pdf).toBe("application/pdf");
    expect(mediaContentTypes["7z"]).toBe("application/x-7z-compressed");
    expect(
      mediaFormats.every((format) => mediaKeySchema.safeParse(mediaKey(hash, format)).success),
    ).toBe(true);
  });
});

describe("stored files", () => {
  const stored = { key: mediaKey(hash, "pdf"), name: "statut.pdf", format: "pdf", bytes: 10 };

  it("describe a file in storage within the size limit", ({ expect }) => {
    expect(storedFileSchema.parse(stored)).toEqual(stored);
    expect(MAX_FILE_BYTES).toBe(104_857_600);
    expect(storedFileSchema.safeParse({ ...stored, bytes: MAX_FILE_BYTES + 1 }).success).toBe(
      false,
    );
    expect(storedFileSchema.safeParse({ ...stored, bytes: 0 }).success).toBe(false);
    expect(storedFileSchema.safeParse({ ...stored, name: " " }).success).toBe(false);
  });

  it("are linked from pages with a title and optional description", ({ expect }) => {
    const link = { title: "Statut", href: mediaPath(stored.key), format: "pdf", bytes: 10 };

    expect(fileLinkSchema.parse({ ...link, description: "Tekst jednolity." })).toEqual({
      ...link,
      description: "Tekst jednolity.",
    });
    expect(filesBlockSchema.safeParse({ type: "files", label: "Pliki", files: [] }).success).toBe(
      false,
    );
    expect(
      filesBlockSchema.safeParse({
        type: "files",
        label: "Pliki",
        files: Array.from({ length: 61 }, () => link),
      }).success,
    ).toBe(false);
  });
});
