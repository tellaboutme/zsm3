import type { PanelRouteName } from "@zsm3/contracts/panel";

import {
  eventsSaveMutation,
  newsSaveMutation,
  newsStatusMutation,
  pageSaveMutation,
  redirectSaveMutation,
  sampleEvent,
  sampleNews,
  samplePage,
  staffMember,
} from "./panel-fixtures.ts";
import { siteCases } from "./panel-matrix-site.ts";
import type { PanelHarness } from "./panel-support.ts";
import { panelJsonCall, panelUploadRequest } from "./panel-support.ts";
import type { StaffRole } from "../../src/storage/staff-repo.ts";

export type RoleName = StaffRole | "none";

export const ROLES: readonly RoleName[] = [
  "admin",
  "secretariat",
  "editor",
  "gallery_editor",
  "none",
];

export const rolesByToken = new Map<string, RoleName>();

export const OK_STATUS: Record<PanelRouteName, number> = {
  me: 200,
  "news.list": 200,
  "news.get": 200,
  "news.create": 201,
  "news.update": 200,
  "news.publish": 200,
  "pages.list": 200,
  "pages.get": 200,
  "pages.save": 200,
  "events.get": 200,
  "events.save": 200,
  "files.list": 200,
  "files.upload": 201,
  "redirects.list": 200,
  "short-links.list": 200,
  "redirects.save": 200,
  "redirects.delete": 204,
  "staff.list": 200,
  "staff.save": 200,
  "announcements.list": 200,
  "announcements.create": 201,
  "announcements.update": 200,
  "announcements.delete": 204,
  "bells.get": 200,
  "bells.save": 200,
  "revisions.list": 200,
  "revisions.restore": 200,
  "audit.list": 200,
  "datasets.get": 200,
  "datasets.save": 200,
};

export const NEWS = sampleNews("istniejacy", "Istniejacy salon");
export const PAGE = samplePage("/kontakt", "Kontakt");
const UPLOAD = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "raport.pdf");

interface RouteCase {
  readonly name: PanelRouteName;
  readonly call: (token: string) => Promise<Response>;
}

export function routeCases(harness: PanelHarness): readonly RouteCase[] {
  return [
    { name: "me", call: async (token) => panelJsonCall(harness, "GET", "/me", { token }) },
    { name: "news.list", call: async (token) => panelJsonCall(harness, "GET", "/news", { token }) },
    {
      name: "news.get",
      call: async (token) => panelJsonCall(harness, "GET", "/news/2026/istniejacy", { token }),
    },
    {
      name: "news.create",
      call: async (token) => {
        const role = rolesByToken.get(token);
        if (role === undefined) {
          throw new Error("fixture");
        }
        return panelJsonCall(harness, "POST", "/news", {
          token,
          body: newsSaveMutation(sampleNews(`nowy-${role}`, "Nowy salon")),
        });
      },
    },
    {
      name: "news.update",
      call: async (token) =>
        panelJsonCall(harness, "PUT", "/news/2026/istniejacy", {
          token,
          body: newsSaveMutation(NEWS),
        }),
    },
    {
      name: "news.publish",
      call: async (token) => {
        const role = rolesByToken.get(token);
        if (role === undefined) {
          throw new Error("fixture");
        }
        return panelJsonCall(harness, "PATCH", "/news/2026/istniejacy", {
          token,
          body: newsStatusMutation(role === "secretariat" ? "unpublish" : "publish"),
        });
      },
    },
    {
      name: "pages.list",
      call: async (token) => panelJsonCall(harness, "GET", "/pages", { token }),
    },
    {
      name: "pages.get",
      call: async (token) => panelJsonCall(harness, "GET", "/pages/kontakt", { token }),
    },
    {
      name: "pages.save",
      call: async (token) =>
        panelJsonCall(harness, "PUT", "/pages/kontakt", {
          token,
          body: pageSaveMutation(samplePage("/kontakt", "Kontakty sluzbowe"), "published"),
        }),
    },
    {
      name: "events.get",
      call: async (token) => panelJsonCall(harness, "GET", "/events/2026", { token }),
    },
    {
      name: "events.save",
      call: async (token) =>
        panelJsonCall(harness, "PUT", "/events/2026", {
          token,
          body: eventsSaveMutation([sampleEvent("2026-09-15", "Rozpoczecie roku")]),
        }),
    },
    {
      name: "files.list",
      call: async (token) => panelJsonCall(harness, "GET", "/files", { token }),
    },
    {
      name: "files.upload",
      call: async (token) => harness.app.fetch(panelUploadRequest(token, UPLOAD), harness.env),
    },
    {
      name: "redirects.list",
      call: async (token) => panelJsonCall(harness, "GET", "/redirects", { token }),
    },
    {
      name: "short-links.list",
      call: async (token) => panelJsonCall(harness, "GET", "/short-links", { token }),
    },
    {
      name: "redirects.save",
      call: async (token) =>
        panelJsonCall(harness, "PUT", "/redirects", {
          token,
          body: redirectSaveMutation({ from: "/nowa-wizytowka", to: "/kontakt" }),
        }),
    },
    {
      name: "redirects.delete",
      call: async (token) =>
        panelJsonCall(harness, "DELETE", "/redirects/stara", { token, body: {} }),
    },
    {
      name: "staff.list",
      call: async (token) => panelJsonCall(harness, "GET", "/staff", { token }),
    },
    {
      name: "staff.save",
      call: async (token) =>
        panelJsonCall(harness, "PUT", "/staff", {
          token,
          body: { entity: "staff", item: staffMember("nowy@zsm3.test", "editor", true) },
        }),
    },
    ...siteCases(harness, rolesByToken),
  ];
}
