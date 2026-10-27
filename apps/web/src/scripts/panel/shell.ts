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

export function wireShell(view: GateView, enter: ShellEnter): void {
  wireGate(view, (role, me) => {
    if (me !== undefined) {
      presentMe(me);
    }
    enter(role, me);
  });
}
