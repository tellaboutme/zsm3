import "../../lib/panel/zod-jitless.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { canEditContent } from "../../lib/panel/gate.ts";

function boot(section: HTMLElement): void {
  const view = gateView(section);
  wireShell(view, (role) => {
    if (!canEditContent(role)) {
      denyContent(view);
    }
  });
}

const section = document.querySelector<HTMLElement>('[data-panel-page="overview"]');

if (section !== null) {
  boot(section);
}
