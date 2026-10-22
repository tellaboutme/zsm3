export const signers = ["uczen", "rodzic"] as const;

export type Signer = (typeof signers)[number] | "kazdy";

export type SignerFilter = (typeof signers)[number] | "wszyscy";

export interface SchoolDocument {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly signer: Signer;
  readonly href: string;
  readonly bytes: number;
  readonly updated: string;
}

export interface DocumentGroup {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly documents: readonly SchoolDocument[];
}

export const signerLabels: Readonly<Record<Signer, string>> = {
  uczen: "Pełnoletni uczeń",
  rodzic: "Rodzic lub opiekun prawny",
  kazdy: "Uczeń lub absolwent",
};

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;

export function fileSize(bytes: number): string {
  if (bytes < MEGABYTE) {
    return `${String(Math.max(1, Math.round(bytes / KILOBYTE)))} KB`;
  }
  return `${(bytes / MEGABYTE).toFixed(1).replace(".", ",")} MB`;
}

export function isSignerFilter(value: string | undefined): value is SignerFilter {
  return value === "wszyscy" || signers.some((signer) => signer === value);
}

export function matchesSigner(signer: string | undefined, filter: SignerFilter): boolean {
  return filter === "wszyscy" || signer === "kazdy" || signer === filter;
}

export function documentCount(groups: readonly DocumentGroup[]): number {
  return groups.reduce((total, group) => total + group.documents.length, 0);
}
