import { area } from "./dom.ts";
import { userLine, wireGate, type GateView } from "./gate-ui.ts";
import type { PanelMe } from "../../lib/panel/models.ts";

export type ShellEnter = (role: string, me: PanelMe | undefined) => void;

function presentMe(me: PanelMe): void {
  const user = area(document.body, "panel-user");
  user.textContent = userLine(me);
  const logout = area(document.body, "panel-logout");
  logout.hidden = false;
}

function pruneTabs(role: string): void {
  if (role === "admin") {
    return;
  }
  const tabs = document.querySelector<HTMLElement>('[data-panel="tabs"]');
  if (tabs === null) {
    return;
  }
  for (const link of tabs.querySelectorAll<HTMLAnchorElement>("a[data-admin]")) {
    link.closest("li")?.remove();
  }
}

export function wireShell(view: GateView, enter: ShellEnter): void {
  wireGate(view, (role, me) => {
    if (me !== undefined) {
      presentMe(me);
    }
    pruneTabs(role);
    enter(role, me);
  });
}
