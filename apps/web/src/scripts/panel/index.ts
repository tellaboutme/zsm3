import "../../lib/panel/zod-jitless.ts";
import { area } from "./dom.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { canEditContent } from "../../lib/panel/gate.ts";

function prune(nav: HTMLElement, role: string): void {
  if (role === "admin") {
    return;
  }
  const links = nav.querySelectorAll<HTMLAnchorElement>("a[data-admin]");
  for (const link of links) {
    const item = link.closest("li");
    item?.remove();
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
