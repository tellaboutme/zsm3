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

export function newsSaveMutation(item: News): {
  entity: "news";
  mutation: { action: "save"; item: News };
} {
  return { entity: "news", mutation: { action: "save", item } };
}

export function newsStatusMutation(action: "publish" | "unpublish"): {
  entity: "news";
  mutation: { action: "publish" | "unpublish" };
} {
  return { entity: "news", mutation: { action } };
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

export function pageSaveMutation(
  page: ContentPage,
  status: PublicationStatus,
): { entity: "pages"; action: "save"; page: ContentPage; status: PublicationStatus } {
  return { entity: "pages", action: "save", page, status };
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
