import { area, areaButton, areaForm, areaInput, areaSelect, button, el, speak } from "./dom.ts";
import { panelRead, problemPhrase } from "../../lib/panel/api.ts";
import { listQuery, pagination, type ListFilter } from "../../lib/panel/lists.ts";
import {
  PANEL_SCHEMAS,
  parse,
  type PanelNewsItem,
  type PanelNewsList,
} from "../../lib/panel/models.ts";

type StatusValue = "all" | "draft" | "published";

const OPTIONS: readonly { readonly value: StatusValue; readonly label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "draft", label: "Szkice" },
  { value: "published", label: "Publikowane" },
];

const LABELS: Readonly<Record<string, string>> = {
  draft: "Szkic",
  published: "Opublikowany",
};

export interface NewsList {
  refresh(): Promise<void>;
}

interface Parts {
  readonly status: HTMLElement;
  readonly items: HTMLUListElement;
  readonly pager: HTMLElement;
  readonly state: ListFilter;
  readonly open: (ref: string) => void;
}

function partsFor(section: HTMLElement, open: (ref: string) => void): Parts {
  const items = area(section, "items");
  if (!(items instanceof HTMLUListElement)) {
    throw new Error(`missing list [data-panel="items"]`);
  }
  return {
    status: area(section, "status"),
    items,
    pager: area(section, "pager"),
    state: { status: "all", page: 1, year: "" },
    open,
  };
}

function statusOf(value: string): StatusValue {
  return OPTIONS.find((option) => option.value === value)?.value ?? "all";
}

function itemNode(item: PanelNewsItem, open: (ref: string) => void): HTMLElement {
  const label = `${item.date} · ${item.category} · ${LABELS[item.status] ?? item.status}`;
  const edit = button("Edytuj", "panel-open");
  edit.setAttribute("aria-label", `Edytuj aktualność ${item.title} z ${item.date}`);
  edit.addEventListener("click", () => {
    open(`${item.date.slice(0, 4)}/${item.slug}`);
  });
  return el("li", {
    className: "panel-item",
    children: [
      el("p", { text: label, className: "panel-meta" }),
      el("strong", { text: item.title }),
      edit,
    ],
  });
}

function pageNode(parts: Parts, label: string, page: number): HTMLElement {
  const node = button(label);
  const name = page === parts.state.page ? "Strona, bieżąca" : "Strona";
  node.setAttribute("aria-label", `${name} ${String(page)}`);
  if (page === parts.state.page) {
    node.setAttribute("aria-current", "page");
  }
  node.addEventListener("click", () => {
    void goPage(parts, page);
  });
  return node;
}

function arrange(parts: Parts, list: PanelNewsList): void {
  const pages = pagination({ total: list.total, page: list.page, pageSize: list.pageSize });
  const nodes: HTMLElement[] = [];
  if (pages.prev !== undefined) {
    nodes.push(pageNode(parts, "Nowsze", pages.prev));
  }
  for (const number of pages.numbers) {
    nodes.push(pageNode(parts, String(number), number));
  }
  if (pages.next !== undefined) {
    nodes.push(pageNode(parts, "Starsze", pages.next));
  }
  parts.pager.replaceChildren(...nodes);
  parts.pager.setAttribute("aria-label", `Strony, ${String(pages.pages)} łącznie`);
  parts.items.replaceChildren(...list.items.map((item) => itemNode(item, parts.open)));
}

async function goPage(parts: Parts, page: number): Promise<void> {
  const state = parts.state;
  state.page = page;
  await refreshParts(parts);
}

async function refreshParts(parts: Parts): Promise<void> {
  const query = listQuery(parts.state).toString();
  speak(parts.status, ["Wczytywanie listy…"]);
  const response = await panelRead(`/api/panel/news?${query}`);
  const list = parse(PANEL_SCHEMAS.newsList, response.data);
  if (list === undefined) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  arrange(parts, list);
  speak(parts.status, [`Razem: ${String(list.total)} aktualności.`]);
}

export function wireList(section: HTMLElement, open: (ref: string) => void): NewsList {
  const parts = partsFor(section, open);
  const filter = areaForm(section, "filter");
  const yearInput = areaInput(section, "filter-year");
  const select = areaSelect(section, "filter-status");
  select.replaceChildren(
    ...OPTIONS.map((option) => {
      const node = document.createElement("option");
      node.value = option.value;
      node.textContent = option.label;
      return node;
    }),
  );
  select.addEventListener("change", () => {
    parts.state.status = statusOf(select.value);
    void refreshParts(parts);
  });
  filter.addEventListener("submit", (event) => {
    event.preventDefault();
    parts.state.year = yearInput.value;
    void refreshParts(parts);
  });
  areaButton(section, "new").addEventListener("click", () => {
    open("");
  });
  return {
    refresh: async () => {
      return refreshParts(parts);
    },
  };
}
