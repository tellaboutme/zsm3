import type { AnnouncementInput } from "@zsm3/contracts/announcements";
import type { BellSchedule } from "@zsm3/contracts/bells";
import type {
  ContentPage,
  News,
  PublicationStatus,
  Redirect,
  SchoolEvent,
} from "@zsm3/contracts/content";
import type { PanelDatasetSave } from "@zsm3/contracts/datasets";
import type { PanelMutation, PanelStaffMember } from "@zsm3/contracts/panel";
import type { PanelRevisionRestore } from "@zsm3/contracts/revisions";

export interface NewsSave {
  readonly item: News;
  readonly expectedRevision: number | null;
}

export interface NewsPublish {
  readonly action: "publish" | "unpublish";
  readonly expectedRevision: number;
}

export interface PageSave {
  readonly page: ContentPage;
  readonly status: PublicationStatus;
  readonly expectedRevision: number | null;
}

export function newsMutation(data: PanelMutation | undefined): NewsSave | undefined {
  const mutation = data?.entity === "news" ? data.mutation : undefined;
  if (mutation?.action !== "save") {
    return undefined;
  }
  return { item: mutation.item, expectedRevision: mutation.expectedRevision };
}

export function newsPublish(data: PanelMutation | undefined): NewsPublish | undefined {
  const mutation = data?.entity === "news" ? data.mutation : undefined;
  if (mutation === undefined || mutation.action === "save") {
    return undefined;
  }
  return { action: mutation.action, expectedRevision: mutation.expectedRevision };
}

export function pageSave(data: PanelMutation | undefined): PageSave | undefined {
  return data?.entity === "pages"
    ? { page: data.page, status: data.status, expectedRevision: data.expectedRevision }
    : undefined;
}

export function eventsSave(data: PanelMutation | undefined): readonly SchoolEvent[] | undefined {
  return data?.entity === "events" ? data.events : undefined;
}

export function redirectSave(data: PanelMutation | undefined): Redirect | undefined {
  return data?.entity === "redirects" ? data.item : undefined;
}

export function staffSave(data: PanelMutation | undefined): PanelStaffMember | undefined {
  return data?.entity === "staff" ? data.item : undefined;
}

export function announcementSave(data: PanelMutation | undefined): AnnouncementInput | undefined {
  return data?.entity === "announcements" ? data.item : undefined;
}

export function bellsSave(data: PanelMutation | undefined): BellSchedule | undefined {
  return data?.entity === "bells" ? data.schedule : undefined;
}

export function revisionRestore(data: PanelMutation | undefined): PanelRevisionRestore | undefined {
  return data?.entity === "revisions" ? data : undefined;
}

export function datasetSave(data: PanelMutation | undefined): PanelDatasetSave | undefined {
  return data?.entity === "datasets" ? data : undefined;
}
