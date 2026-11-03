import type { PublicationStatus } from "@zsm3/contracts/content";

export interface PublicChange {
  readonly before: PublicationStatus | undefined;
  readonly after: PublicationStatus;
  readonly edited: boolean;
}

export function announcesChange({ before, after, edited }: PublicChange): boolean {
  const wasPublic = before === "published";
  const isPublic = after === "published";
  return wasPublic !== isPublic || (isPublic && edited);
}
