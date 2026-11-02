import "../../lib/panel/zod-jitless.ts";
import { area } from "./dom.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { canEditContent, sectionAllowed } from "../../lib/panel/gate.ts";

function prune(nav: HTMLElement, role: string): void {
  for (const link of nav.querySelectorAll<HTMLAnchorElement>("a[data-roles]")) {
    if (!sectionAllowed(link.dataset["roles"], role)) {
      link.closest("li")?.remove();
    }
  }
}

function boot(section: HTMLElement): void {
  const view = gateView(section);
  wireShell(view, (role) => {
    if (!canEditContent(role)) {
      denyContent(view);
      return;
    }
    prune(area(section, "sections"), role);
  });
}

const section = document.querySelector<HTMLElement>('[data-panel-page="overview"]');

if (section !== null) {
  boot(section);
}
