import type { AnnouncementInput } from "@zsm3/contracts/announcements";
import type { BellSchedule } from "@zsm3/contracts/bells";
import type {
  ContentPage,
  News,
  PublicationStatus,
  Redirect,
  SchoolEvent,
} from "@zsm3/contracts/content";
import type { DatasetKey } from "@zsm3/contracts/datasets";
import type { PanelStaffMember } from "@zsm3/contracts/panel";

export interface NewsSaveMutation {
  readonly entity: "news";
  readonly mutation: { readonly action: "save"; readonly item: News };
}

export interface NewsStatusMutation {
  readonly entity: "news";
  readonly mutation: { readonly action: "publish" | "unpublish" };
}

export interface PageSaveMutation {
  readonly entity: "pages";
  readonly action: "save";
  readonly page: ContentPage;
  readonly status: PublicationStatus;
}

export interface EventsSaveMutation {
  readonly entity: "events";
  readonly events: readonly SchoolEvent[];
}

export interface RedirectSaveMutation {
  readonly entity: "redirects";
  readonly item: Redirect;
}

export interface StaffSaveMutation {
  readonly entity: "staff";
  readonly item: PanelStaffMember;
}

export interface AnnouncementSaveMutation {
  readonly entity: "announcements";
  readonly item: AnnouncementInput;
}

export interface BellsSaveMutation {
  readonly entity: "bells";
  readonly schedule: BellSchedule;
}

export interface DatasetSaveMutation {
  readonly entity: "datasets";
  readonly key: DatasetKey;
  readonly data: unknown;
}

export function newsSave(item: News): NewsSaveMutation {
  return { entity: "news", mutation: { action: "save", item } };
}

export function newsStatus(action: "publish" | "unpublish"): NewsStatusMutation {
  return { entity: "news", mutation: { action } };
}

export function pageSave(page: ContentPage, status: PublicationStatus): PageSaveMutation {
  return { entity: "pages", action: "save", page, status };
}

export function eventsSave(events: readonly SchoolEvent[]): EventsSaveMutation {
  return { entity: "events", events };
}

export function redirectSave(item: Redirect): RedirectSaveMutation {
  return { entity: "redirects", item };
}

export function staffSave(item: PanelStaffMember): StaffSaveMutation {
  return { entity: "staff", item };
}

export function announcementSave(item: AnnouncementInput): AnnouncementSaveMutation {
  return { entity: "announcements", item };
}

export function bellsSave(schedule: BellSchedule): BellsSaveMutation {
  return { entity: "bells", schedule };
}

export function datasetSave(key: DatasetKey, data: unknown): DatasetSaveMutation {
  return { entity: "datasets", key, data };
}
