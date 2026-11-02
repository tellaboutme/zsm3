import {
  panelSavedSchema,
  type PanelRevisionRestore,
  type RevisionTarget,
} from "@zsm3/contracts/revisions";

export interface RevisionSummary {
  readonly revision: number;
  readonly at: string;
  readonly actorEmail: string | null;
  readonly title: string;
  readonly status: "draft" | "published";
}

const STATUS_LABELS = { draft: "szkic", published: "opublikowana" } as const;

const MOMENT = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function revisionsPath(target: RevisionTarget, id: string): string {
  return `/api/panel/revisions/${target}?id=${encodeURIComponent(id)}`;
}

export function revisionLine(item: RevisionSummary): string {
  const who = item.actorEmail ?? "system";
  return `Wersja ${String(item.revision)} · ${MOMENT.format(new Date(item.at))} · ${who} · ${STATUS_LABELS[item.status]}`;
}

export function restoreMutation(
  target: RevisionTarget,
  id: string,
  revision: number,
  expectedRevision: number,
): PanelRevisionRestore {
  return { entity: "revisions", target, id, revision, expectedRevision };
}

export function latestRevision(items: readonly RevisionSummary[]): number {
  return Math.max(0, ...items.map((item) => item.revision));
}

export function savedRevision(data: unknown): number | undefined {
  const saved = panelSavedSchema.safeParse(data);
  return saved.success ? saved.data.revision : undefined;
}
