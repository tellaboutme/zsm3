import {
  announcementInputSchema,
  type AnnouncementInput,
  type AnnouncementSeverity,
  type StoredAnnouncement,
} from "@zsm3/contracts/announcements";

export interface AnnouncementFields {
  readonly severity: string;
  readonly text: string;
  readonly linkLabel: string;
  readonly linkHref: string;
  readonly startsOn: string;
  readonly endsOn: string;
}

export type AnnouncementDraft =
  | { readonly ok: true; readonly item: AnnouncementInput }
  | { readonly ok: false; readonly problem: string };

export type AnnouncementState = "active" | "planned" | "ended";

export const SEVERITY_OPTIONS: readonly { value: AnnouncementSeverity; label: string }[] = [
  { value: "info", label: "Informacja (szary pasek, można ukryć)" },
  { value: "important", label: "Ważne (niebieski pasek, można ukryć)" },
  { value: "urgent", label: "Pilne (czerwony pasek, nie da się ukryć)" },
];

const STATE_LABELS: Readonly<Record<AnnouncementState, string>> = {
  active: "Widoczne teraz",
  planned: "Zaplanowane",
  ended: "Zakończone",
};

function linkPart(fields: AnnouncementFields): AnnouncementInput["link"] | string {
  const label = fields.linkLabel.trim();
  const href = fields.linkHref.trim();
  if (label.length === 0 && href.length === 0) {
    return undefined;
  }
  if (label.length === 0 || href.length === 0) {
    return "Link wymaga obu pól: tekstu i adresu.";
  }
  return { label, href };
}

export function announcementDraft(fields: AnnouncementFields): AnnouncementDraft {
  const link = linkPart(fields);
  if (typeof link === "string") {
    return { ok: false, problem: link };
  }
  if (fields.endsOn !== "" && fields.startsOn !== "" && fields.endsOn < fields.startsOn) {
    return { ok: false, problem: "Ostatni dzień nie może być przed pierwszym." };
  }
  const parsed = announcementInputSchema.safeParse({
    severity: fields.severity,
    text: fields.text,
    ...(link === undefined ? {} : { link }),
    startsOn: fields.startsOn,
    endsOn: fields.endsOn,
  });
  if (!parsed.success) {
    return {
      ok: false,
      problem:
        "Uzupełnij treść (do 300 znaków) i obie daty. Adres linku zaczyna się od „/” albo „https://”.",
    };
  }
  return { ok: true, item: parsed.data };
}

export function announcementState(item: StoredAnnouncement, today: string): AnnouncementState {
  if (item.endsOn < today) {
    return "ended";
  }
  return item.startsOn > today ? "planned" : "active";
}

export function announcementSummary(item: StoredAnnouncement, today: string): string {
  const days = item.startsOn === item.endsOn ? item.startsOn : `${item.startsOn} – ${item.endsOn}`;
  return `${STATE_LABELS[announcementState(item, today)]} · ${days}`;
}
