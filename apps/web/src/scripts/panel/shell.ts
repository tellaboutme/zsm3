import { area } from "./dom.ts";
import { userLine, wireGate, type GateView } from "./gate-ui.ts";
import { sectionAllowed } from "../../lib/panel/gate.ts";
import type { PanelMe } from "../../lib/panel/models.ts";

export type ShellEnter = (role: string, me: PanelMe | undefined) => void;

function presentMe(me: PanelMe): void {
  const user = area(document.body, "panel-user");
  user.textContent = userLine(me);
  const logout = area(document.body, "panel-logout");
  logout.hidden = false;
}

export function pruneSections(root: ParentNode, role: string): void {
  for (const link of root.querySelectorAll<HTMLAnchorElement>("a[data-roles]")) {
    if (!sectionAllowed(link.dataset["roles"], role)) {
      link.closest("li")?.remove();
    }
  }
}

export function wireShell(view: GateView, enter: ShellEnter): void {
  wireGate(view, (role, me) => {
    if (me !== undefined) {
      presentMe(me);
    }
    pruneSections(document, role);
    enter(role, me);
  });
}
