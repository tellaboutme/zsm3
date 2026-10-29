import type { PanelRouteName } from "@zsm3/contracts/panel";

import type { StaffRole } from "../../storage/staff-repo.ts";

const CONTENT_ROLES: readonly StaffRole[] = ["admin", "secretariat", "editor"];
const ALL_STAFF_ROLES: readonly StaffRole[] = ["admin", "secretariat", "editor", "gallery_editor"];

export const PANEL_MATRIX: Readonly<Record<PanelRouteName, readonly StaffRole[]>> = {
  me: ALL_STAFF_ROLES,
  "news.list": CONTENT_ROLES,
  "news.get": CONTENT_ROLES,
  "news.create": CONTENT_ROLES,
  "news.update": CONTENT_ROLES,
  "news.publish": CONTENT_ROLES,
  "pages.list": CONTENT_ROLES,
  "pages.get": CONTENT_ROLES,
  "pages.save": CONTENT_ROLES,
  "events.get": CONTENT_ROLES,
  "events.save": CONTENT_ROLES,
  "files.list": CONTENT_ROLES,
  "files.upload": CONTENT_ROLES,
  "redirects.list": ["admin"],
  "short-links.list": CONTENT_ROLES,
  "short-links.revoke": CONTENT_ROLES,
  "redirects.save": ["admin"],
  "redirects.delete": ["admin"],
  "staff.list": ["admin"],
  "staff.save": ["admin"],
  "announcements.list": CONTENT_ROLES,
  "announcements.create": CONTENT_ROLES,
  "announcements.update": CONTENT_ROLES,
  "announcements.delete": CONTENT_ROLES,
  "bells.get": CONTENT_ROLES,
  "bells.save": CONTENT_ROLES,
  "revisions.list": CONTENT_ROLES,
  "revisions.restore": CONTENT_ROLES,
  "audit.list": ["admin"],
  "datasets.get": CONTENT_ROLES,
  "datasets.save": CONTENT_ROLES,
};

export function routeAllowed(name: PanelRouteName, role: StaffRole): boolean {
  return PANEL_MATRIX[name].includes(role);
}
