import type { PanelRouteName } from "@zsm3/contracts/panel";

import type { PanelHarness } from "./panel-support.ts";
import { panelJsonCall } from "./panel-support.ts";

interface RouteCase {
  readonly name: PanelRouteName;
  readonly call: (token: string) => Promise<Response>;
}

export const announcementIds = new Map<string, string>();

export const ANNOUNCEMENT = {
  severity: "info",
  text: "Jutro zebranie z rodzicami.",
  startsOn: "2026-10-20",
  endsOn: "2026-10-30",
} as const;

function announcementFor(rolesByToken: ReadonlyMap<string, string>, token: string): string {
  const role = rolesByToken.get(token);
  const id = role === undefined ? undefined : announcementIds.get(role);
  if (id === undefined) {
    throw new Error("fixture");
  }
  return id;
}

function sharedAnnouncement(): string {
  const id = announcementIds.get("shared");
  if (id === undefined) {
    throw new Error("fixture");
  }
  return id;
}

export const BELLS = {
  entity: "bells",
  schedule: {
    regular: [{ start: "08:00", end: "08:45" }],
    variants: [
      { id: "skrocone", label: "Lekcje skrócone", lessons: [{ start: "08:00", end: "08:30" }] },
    ],
    days: [{ date: "2026-10-30", variant: "skrocone" }],
  },
} as const;

export function siteCases(
  harness: PanelHarness,
  rolesByToken: ReadonlyMap<string, string>,
): readonly RouteCase[] {
  return [
    {
      name: "announcements.list",
      call: async (token) => panelJsonCall(harness, "GET", "/announcements", { token }),
    },
    {
      name: "announcements.create",
      call: async (token) =>
        panelJsonCall(harness, "POST", "/announcements", {
          token,
          body: { entity: "announcements", item: ANNOUNCEMENT },
        }),
    },
    {
      name: "announcements.update",
      call: async (token) =>
        panelJsonCall(harness, "PUT", `/announcements/${sharedAnnouncement()}`, {
          token,
          body: { entity: "announcements", item: { ...ANNOUNCEMENT, severity: "important" } },
        }),
    },
    {
      name: "announcements.delete",
      call: async (token) =>
        panelJsonCall(harness, "DELETE", `/announcements/${announcementFor(rolesByToken, token)}`, {
          token,
          body: {},
        }),
    },
    {
      name: "bells.get",
      call: async (token) => panelJsonCall(harness, "GET", "/bells", { token }),
    },
    {
      name: "bells.save",
      call: async (token) => panelJsonCall(harness, "PUT", "/bells", { token, body: BELLS }),
    },
    {
      name: "datasets.get",
      call: async (token) => panelJsonCall(harness, "GET", "/datasets/partnerzy", { token }),
    },
    {
      name: "datasets.save",
      call: async (token) =>
        panelJsonCall(harness, "PUT", "/datasets/partnerzy", {
          token,
          body: {
            entity: "datasets",
            key: "partnerzy",
            data: [{ name: "Erasmus+", role: "wyjazdy" }],
          },
        }),
    },
    {
      name: "audit.list",
      call: async (token) => panelJsonCall(harness, "GET", "/audit", { token }),
    },
    {
      name: "revisions.list",
      call: async (token) =>
        panelJsonCall(harness, "GET", "/revisions/pages?id=/kontakt", { token }),
    },
    {
      name: "revisions.restore",
      call: async (token) =>
        panelJsonCall(harness, "POST", "/revisions/restore", {
          token,
          body: { entity: "revisions", target: "pages", id: "/kontakt", revision: 1 },
        }),
    },
  ];
}
