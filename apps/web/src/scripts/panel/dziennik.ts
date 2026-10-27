import "../../lib/panel/zod-jitless.ts";
import { area, areaButton, areaList, el, speak } from "./dom.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { panelRead, problemPhrase } from "../../lib/panel/api.ts";
import { auditHead, auditLine, auditPath } from "../../lib/panel/audit.ts";
import { PANEL_SCHEMAS, parse } from "../../lib/panel/models.ts";

interface Parts {
  readonly rows: HTMLUListElement;
  readonly more: HTMLButtonElement;
  readonly status: HTMLElement;
}

async function loadPage(parts: Parts, cursor: string | null): Promise<void> {
  const { more } = parts;
  more.disabled = true;
  const response = await panelRead(auditPath(cursor));
  more.disabled = false;
  const list = parse(PANEL_SCHEMAS.auditList, response.data);
  if (list === undefined) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  parts.rows.append(
    ...list.items.map((item) =>
      el("li", {
        className: "panel-item",
        children: [
          el("p", { className: "panel-meta", text: auditHead(item) }),
          el("p", { text: auditLine(item) }),
        ],
      }),
    ),
  );
  more.hidden = list.next === null;
  more.dataset["cursor"] = list.next ?? "";
  speak(parts.status, [`Wpisów na liście: ${String(parts.rows.children.length)}.`]);
}

export function wireDziennik(section: HTMLElement): void {
  const parts: Parts = {
    rows: areaList(section, "audit-rows"),
    more: areaButton(section, "audit-more"),
    status: area(section, "status"),
  };
  parts.more.addEventListener("click", () => {
    void loadPage(parts, parts.more.dataset["cursor"] ?? null);
  });
  const view = gateView(section);
  wireShell(view, (role) => {
    if (role !== "admin") {
      denyContent(view);
      return;
    }
    void loadPage(parts, null);
  });
}

const section = document.querySelector<HTMLElement>('[data-panel-page="audit"]');

if (section !== null) {
  wireDziennik(section);
}
