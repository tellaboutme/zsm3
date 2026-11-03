import type { PanelRouteName } from "@zsm3/contracts/panel";

import type { PanelHarness } from "./panel-support.ts";
import { panelJsonCall } from "./panel-support.ts";

interface RouteCase {
  readonly name: PanelRouteName;
  readonly call: (token: string) => Promise<Response>;
}

export function linkCases(harness: PanelHarness): readonly RouteCase[] {
  return [
    {
      name: "short-links.list",
      call: async (token) => panelJsonCall(harness, "GET", "/short-links", { token }),
    },
    {
      name: "short-links.create",
      call: async (token) =>
        panelJsonCall(harness, "POST", "/short-links", {
          token,
          body: { target: "https://example.org/materialy" },
        }),
    },
    {
      name: "short-links.revoke",
      call: async (token) =>
        panelJsonCall(harness, "DELETE", "/short-links/invalid", { token, body: {} }),
    },
    {
      name: "short-links.all",
      call: async (token) => panelJsonCall(harness, "GET", "/short-links/all", { token }),
    },
    {
      name: "short-links.admin-revoke",
      call: async (token) =>
        panelJsonCall(harness, "DELETE", "/short-links/all/invalid", { token, body: {} }),
    },
  ];
}
