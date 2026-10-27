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

export function newsMutation(data: PanelMutation | undefined): News | undefined {
  const mutation = data?.entity === "news" ? data.mutation : undefined;
  if (mutation?.action !== "save") {
    return undefined;
  }
  return mutation.item;
}

export function newsPublish(data: PanelMutation | undefined): "publish" | "unpublish" | undefined {
  const action = (data?.entity === "news" ? data.mutation : undefined)?.action;
  if (action === undefined || action === "save") {
    return undefined;
  }
  return action;
}

export function pageSave(
  data: PanelMutation | undefined,
): { page: ContentPage; status: PublicationStatus } | undefined {
  return data?.entity === "pages" ? { page: data.page, status: data.status } : undefined;
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
