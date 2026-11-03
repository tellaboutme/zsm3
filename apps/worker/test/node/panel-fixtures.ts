import type {
  ContentPage,
  News,
  PublicationStatus,
  Redirect,
  SchoolEvent,
} from "@zsm3/contracts/content";

import type { StaffInput } from "../../src/storage/staff-repo.ts";

export type StaffRole = "admin" | "secretariat" | "editor" | "gallery_editor";

export function staffMember(email: string, role: StaffRole, active: boolean): StaffInput {
  return { email, role, active };
}

const BODY: News["body"] = [{ type: "paragraph", content: [{ type: "text", text: "Relacja." }] }];

export function sampleNews(slug: string, title: string, overrides: Partial<News> = {}): News {
  return {
    slug,
    date: "2026-09-14",
    category: "Aktualnosci",
    title,
    lead: "Relacja ze szkolnego Salonu Maturzystow.",
    body: BODY,
    ...overrides,
  };
}

export function newsSaveMutation(
  item: News,
  expectedRevision: number | null = null,
): {
  entity: "news";
  mutation: { action: "save"; item: News; expectedRevision: number | null };
} {
  return { entity: "news", mutation: { action: "save", item, expectedRevision } };
}

export function newsStatusMutation(
  action: "publish" | "unpublish",
  expectedRevision = 0,
): {
  entity: "news";
  mutation: { action: "publish" | "unpublish"; expectedRevision: number };
} {
  return { entity: "news", mutation: { action, expectedRevision } };
}

export function samplePage(path: string, title: string): ContentPage {
  return {
    path,
    kicker: "Szkola",
    title,
    intro: "Aktualne informacje o kontaktach.",
    sections: [
      {
        id: "opis",
        title: "Opis",
        blocks: [
          {
            type: "rich-text",
            document: [{ type: "paragraph", content: [{ type: "text", text: "Informacje." }] }],
          },
        ],
      },
    ],
  };
}

export interface PageSaveBody {
  readonly entity: "pages";
  readonly action: "save";
  readonly page: ContentPage;
  readonly status: PublicationStatus;
  readonly expectedRevision: number | null;
}

export function pageSaveMutation(
  page: ContentPage,
  status: PublicationStatus,
  expectedRevision: number | null = null,
): PageSaveBody {
  return { entity: "pages", action: "save", page, status, expectedRevision };
}

export function restoreMutation(
  target: string,
  id: string,
  revision: number,
  expectedRevision: number,
): unknown {
  return { entity: "revisions", target, id, revision, expectedRevision };
}

export function sampleEvent(date: string, title: string): SchoolEvent {
  return { date, title, audience: "Wszyscy", kind: "uroczystosc" };
}

export function eventsSaveMutation(events: SchoolEvent[]): {
  entity: "events";
  events: SchoolEvent[];
} {
  return { entity: "events", events };
}

export function sampleRedirect(from: string, to: string): Redirect {
  return { from, to };
}

export function redirectSaveMutation(item: Redirect): { entity: "redirects"; item: Redirect } {
  return { entity: "redirects", item };
}
