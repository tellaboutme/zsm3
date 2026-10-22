export type Severity = "info" | "important" | "urgent";

export interface Announcement {
  readonly id: string;
  readonly severity: Severity;
  readonly text: string;
  readonly link?: { readonly label: string; readonly href: string };
}

export const DISMISSED_KEY = "zsm3.dismissed-banners";

export function readDismissed(serialized: string | null): ReadonlySet<string> {
  if (serialized === null) {
    return new Set();
  }
  try {
    const parsed: unknown = JSON.parse(serialized);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

export function withDismissed(dismissed: ReadonlySet<string>, id: string): string {
  return JSON.stringify([...new Set([...dismissed, id])]);
}
