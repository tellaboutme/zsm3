import { area, areaButton, button, el, speak } from "./dom.ts";
import { panelRead, problemPhrase } from "../../lib/panel/api.ts";
import { PANEL_SCHEMAS, parse, type PanelPageItem } from "../../lib/panel/models.ts";

const LABELS: Readonly<Record<string, string>> = {
  draft: "Szkic",
  published: "Opublikowana",
};

export interface PageList {
  readonly refresh: () => Promise<void>;
}

function itemsOf(section: HTMLElement): HTMLUListElement {
  const node = area(section, "page-list");
  if (node instanceof HTMLUListElement) {
    return node;
  }
  throw new Error(`missing list [data-panel="page-list"]`);
}

function itemNode(item: PanelPageItem, open: (path: string) => void): HTMLElement {
  const edit = button("Edytuj", "panel-open");
  edit.setAttribute("aria-label", `Edytuj stronę ${item.path}`);
  edit.addEventListener("click", () => {
    open(item.path);
  });
  return el("li", {
    className: "panel-item",
    children: [
      el("p", {
        className: "panel-meta",
        text: `${item.path} · ${LABELS[item.status] ?? item.status}`,
      }),
      el("strong", { text: item.title }),
      edit,
    ],
  });
}

async function refreshOf(
  section: HTMLElement,
  items: HTMLUListElement,
  open: (path: string) => void,
): Promise<void> {
  const status = area(section, "status");
  const response = await panelRead("/api/panel/pages");
  const parsed = parse(PANEL_SCHEMAS.pageList, response.data);
  if (parsed === undefined) {
    speak(status, [problemPhrase(response.status)]);
    return;
  }
  items.replaceChildren(...parsed.items.map((item) => itemNode(item, open)));
  speak(status, [`Razem: ${String(parsed.items.length)} stron.`]);
}

export function wirePageList(section: HTMLElement, open: (path: string) => void): PageList {
  const items = itemsOf(section);
  areaButton(section, "page-new").addEventListener("click", () => {
    open("");
  });
  void refreshOf(section, items, open);
  return {
    refresh: async () => {
      return refreshOf(section, items, open);
    },
  };
}
