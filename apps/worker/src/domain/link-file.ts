import {
  linkFileContentTypes,
  type LinkFileFormat,
  MAX_LINK_FILE_BYTES,
} from "@zsm3/contracts/short-links";

import { storedFirstEntry, zipNames } from "./zip-directory.ts";

export const MAX_FILE_STEM_LENGTH = 150;
export const FALLBACK_STEM = "material";

type OfficeFormat = "docx" | "xlsx" | "pptx";
type OpenDocumentFormat = "odt" | "ods" | "odp";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];
const OFFICE_MANIFEST = "[Content_Types].xml";
const OFFICE_PARTS: Readonly<Record<OfficeFormat, string>> = {
  docx: "word/document.xml",
  xlsx: "xl/workbook.xml",
  pptx: "ppt/presentation.xml",
};
const OFFICE_FORMATS: readonly OfficeFormat[] = ["docx", "xlsx", "pptx"];
const OPEN_DOCUMENT_FORMATS: readonly OpenDocumentFormat[] = ["odt", "ods", "odp"];
const ACTIVE_PART = /(?:^|\/)(?:vbaproject\.bin|activex\/|macrosheets\/)|^(?:basic|scripts)\//u;
const UNSAFE_NAME_CHARACTERS = /[\p{Cc}\p{Cf}"*:<>?|]/gu;

export type UploadSize = "empty" | "large" | "ok";

export type FileVerdict =
  | { readonly kind: "accepted"; readonly format: LinkFileFormat; readonly name: string }
  | { readonly kind: "unsupported" };

export function uploadSize(bytes: number): UploadSize {
  if (bytes === 0) {
    return "empty";
  }
  return bytes > MAX_LINK_FILE_BYTES ? "large" : "ok";
}

function isPdf(bytes: Uint8Array): boolean {
  return PDF_MAGIC.every((byte, index) => bytes[index] === byte);
}

function hasActiveContent(names: readonly string[]): boolean {
  return names.some((name) => ACTIVE_PART.test(name.toLowerCase()));
}

function officeFormat(names: readonly string[]): LinkFileFormat | undefined {
  if (!names.includes(OFFICE_MANIFEST)) {
    return undefined;
  }
  return OFFICE_FORMATS.find((format) => names.includes(OFFICE_PARTS[format]));
}

function openDocumentFormat(
  bytes: Uint8Array,
  names: readonly string[],
): LinkFileFormat | undefined {
  const first = storedFirstEntry(bytes);
  if (first?.name !== "mimetype" || !names.includes("content.xml")) {
    return undefined;
  }
  const declared = new TextDecoder().decode(first.data);
  return OPEN_DOCUMENT_FORMATS.find((format) => linkFileContentTypes[format] === declared);
}

export function detectFormat(bytes: Uint8Array): LinkFileFormat | undefined {
  if (isPdf(bytes)) {
    return "pdf";
  }
  const names = zipNames(bytes);
  if (names === undefined || hasActiveContent(names)) {
    return undefined;
  }
  return openDocumentFormat(bytes, names) ?? officeFormat(names);
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function safeFileName(original: string, format: LinkFileFormat): string {
  const base = original.slice(Math.max(original.lastIndexOf("/"), original.lastIndexOf("\\")) + 1);
  const cleaned = base.normalize("NFC").replace(UNSAFE_NAME_CHARACTERS, "").replace(/\s+/gu, " ");
  const dot = cleaned.lastIndexOf(".");
  const stem = Array.from((dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/^[\s.]+/u, ""))
    .slice(0, MAX_FILE_STEM_LENGTH)
    .join("")
    .trim();
  return `${stem === "" ? FALLBACK_STEM : stem}.${format}`;
}

export function inspectUpload(name: string, bytes: Uint8Array): FileVerdict {
  const format = detectFormat(bytes);
  if (format === undefined || extensionOf(name) !== format) {
    return { kind: "unsupported" };
  }
  return { kind: "accepted", format, name: safeFileName(name, format) };
}
