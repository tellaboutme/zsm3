import type { RichText } from "@zsm3/contracts/rich-text";

export interface LegalSection {
  readonly id: string;
  readonly title: string;
  readonly document: RichText;
}

export interface LegalDocument {
  readonly path: string;
  readonly title: string;
  readonly version: string;
  readonly updated: string;
  readonly status: "projekt" | "obowiązuje";
  readonly intro: string;
  readonly sections: readonly LegalSection[];
}

export function statusLabel(document: LegalDocument): string {
  return document.status === "projekt"
    ? "Projekt do zatwierdzenia przez inspektora ochrony danych"
    : "Dokument obowiązujący";
}
