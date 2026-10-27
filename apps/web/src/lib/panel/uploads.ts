import { MAX_FILE_BYTES, mediaFormats, type MediaFormat } from "@zsm3/contracts/media";

const MB = 1024 * 1024;

export type UploadReason = "empty" | "large" | "unknown-format";

export type UploadCheck =
  | { readonly ok: true; readonly format: MediaFormat; readonly parts: readonly string[] }
  | { readonly ok: false; readonly reason: UploadReason };

export function formatFrom(name: string): MediaFormat | undefined {
  const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const absent = name.lastIndexOf(".") < 0;
  if (absent) {
    return undefined;
  }
  return mediaFormats.find((format) => format === extension);
}

export function checkUpload(name: string, bytes: number): UploadCheck {
  if (bytes <= 0) {
    return { ok: false, reason: "empty" };
  }
  if (bytes > MAX_FILE_BYTES) {
    return { ok: false, reason: "large" };
  }
  const format = formatFrom(name);
  if (format === undefined) {
    return { ok: false, reason: "unknown-format" };
  }
  return { ok: true, format, parts: [`format: ${format}`, `rozmiar: ${String(bytes)} B`] };
}

export function uploadPhrase(result: UploadCheck): string {
  if (result.ok) {
    return "Plik spełnia warunki. Możesz wysłać.";
  }
  if (result.reason === "empty") {
    return "Plik jest pusty.";
  }
  if (result.reason === "large") {
    return `Plik przekracza limit ${String(MAX_FILE_BYTES / MB)} MB.`;
  }
  return "Rozszerzenie nie jest z listy dozwolonych: PDF, DOCX, XLSX, ODT, ZIP, 7Z, JPG, PNG.";
}

export function bytesPhrase(bytes: number): string {
  if (bytes >= MB) {
    return `${(bytes / MB).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024).toString()} KB`;
  }
  return `${bytes.toString()} B`;
}
