import "./zod-jitless.ts";
import { announcementListSchema } from "@zsm3/contracts/announcements";
import { panelAuditListSchema } from "@zsm3/contracts/audit";
import { bellScheduleViewSchema } from "@zsm3/contracts/bells";
import { panelDatasetViewSchema } from "@zsm3/contracts/datasets";
import {
  panelEventListSchema,
  panelFileListSchema,
  panelFileViewSchema,
  panelMeSchema,
  panelNewsListSchema,
  panelNewsViewSchema,
  panelPageListSchema,
  panelPageViewSchema,
  panelRedirectListSchema,
  panelStaffListSchema,
} from "@zsm3/contracts/panel";
import { panelRevisionListSchema } from "@zsm3/contracts/revisions";
import type { z } from "zod";

export type PanelMe = z.infer<typeof panelMeSchema>;
export type PanelNewsList = z.infer<typeof panelNewsListSchema>;
export type PanelNewsItem = PanelNewsList["items"][number];
export type PanelNewsView = z.infer<typeof panelNewsViewSchema>;
export type PanelPageList = z.infer<typeof panelPageListSchema>;
export type PanelPageItem = PanelPageList["items"][number];
export type PanelPageView = z.infer<typeof panelPageViewSchema>;
export type PanelEventList = z.infer<typeof panelEventListSchema>;
export type PanelFileList = z.infer<typeof panelFileListSchema>;
export type PanelFileView = z.infer<typeof panelFileViewSchema>;
export type PanelRedirectList = z.infer<typeof panelRedirectListSchema>;
export type PanelAnnouncementList = z.infer<typeof announcementListSchema>;
export type PanelStaffList = z.infer<typeof panelStaffListSchema>;

export function parse<T>(schema: z.ZodType<T>, data: unknown): T | undefined {
  const parsed = schema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

export const PANEL_SCHEMAS = {
  me: panelMeSchema,
  newsList: panelNewsListSchema,
  newsView: panelNewsViewSchema,
  pageList: panelPageListSchema,
  pageView: panelPageViewSchema,
  eventList: panelEventListSchema,
  fileList: panelFileListSchema,
  upload: panelFileViewSchema,
  redirectList: panelRedirectListSchema,
  staffList: panelStaffListSchema,
  announcementList: announcementListSchema,
  bells: bellScheduleViewSchema,
  revisionList: panelRevisionListSchema,
  auditList: panelAuditListSchema,
  dataset: panelDatasetViewSchema,
} as const;
