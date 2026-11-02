import "../../lib/panel/zod-jitless.ts";
import { area } from "./dom.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { pruneSections, wireShell } from "./shell.ts";
import { canEditContent } from "../../lib/panel/gate.ts";

function boot(section: HTMLElement): void {
  const view = gateView(section);
  wireShell(view, (role) => {
    if (!canEditContent(role)) {
      denyContent(view);
      return;
    }
    pruneSections(area(section, "sections"), role);
  });
}

const section = document.querySelector<HTMLElement>('[data-panel-page="overview"]');

if (section !== null) {
  boot(section);
}
