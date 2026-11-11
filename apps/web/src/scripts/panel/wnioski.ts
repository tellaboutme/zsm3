import "../../lib/panel/zod-jitless.ts";
import { panelRequestsListSchema } from "@zsm3/contracts/panel-requests";
import type { PanelRequestSummary } from "@zsm3/contracts/requests";

import { area, areaButton, areaList, areaSelect, button, el, speak } from "./dom.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { RequestDetail } from "./wnioski-detail.ts";
import { detailView } from "./wnioski-view.ts";
import { panelRead, problemPhrase } from "../../lib/panel/api.ts";
import { parse } from "../../lib/panel/models.ts";
import {
  REQUEST_STATUS_LABELS,
  canHandleRequests,
  listPhrase,
  nextCursor,
  requestHead,
  requestTitle,
  requestsPath,
  statusFilter,
  type RequestsCursor,
} from "../../lib/panel/requests.ts";

interface Parts {
  readonly rows: HTMLUListElement;
  readonly more: HTMLButtonElement;
  readonly refresh: HTMLButtonElement;
  readonly filter: HTMLSelectElement;
  readonly status: HTMLElement;
}

interface Listing {
  generation: number;
  cursor: RequestsCursor | null;
  selected: string | undefined;
}

function badge(summary: PanelRequestSummary): HTMLElement {
  return el("span", {
    className: "panel-status",
    text: REQUEST_STATUS_LABELS[summary.status],
    attributes: { "data-status": summary.status },
  });
}

class RequestList {
  private readonly listing: Listing = { generation: 0, cursor: null, selected: undefined };

  private readonly parts: Parts;

  private readonly detail: RequestDetail;

  constructor(parts: Parts, detail: RequestDetail) {
    this.parts = parts;
    this.detail = detail;
    parts.filter.addEventListener("change", () => {
      void this.load(true);
    });
    parts.refresh.addEventListener("click", () => {
      void this.load(true);
    });
    parts.more.addEventListener("click", () => {
      void this.load(false);
    });
  }

  async load(reset: boolean): Promise<void> {
    const { parts, listing } = this;
    listing.generation += 1;
    const generation = listing.generation;
    const filter = statusFilter(parts.filter.value);
    parts.more.disabled = true;
    parts.rows.setAttribute("aria-busy", "true");
    speak(parts.status, ["Wczytuję wnioski…"]);
    const response = await panelRead(requestsPath(filter, reset ? null : listing.cursor));
    if (generation !== listing.generation) {
      return;
    }
    parts.more.disabled = false;
    parts.rows.removeAttribute("aria-busy");
    const list = parse(panelRequestsListSchema, response.data);
    if (reset) {
      parts.rows.replaceChildren();
      listing.cursor = null;
      parts.more.hidden = true;
    }
    if (list === undefined) {
      speak(parts.status, [problemPhrase(response.status)]);
      return;
    }
    parts.rows.append(...list.items.map((item) => this.row(item)));
    listing.cursor = nextCursor(list);
    parts.more.hidden = listing.cursor === null;
    this.mark();
    speak(parts.status, [listPhrase(parts.rows.children.length, filter)]);
  }

  private row(summary: PanelRequestSummary): HTMLElement {
    const open = button("Szczegóły", "panel-open");
    open.setAttribute("aria-label", `Szczegóły wniosku nr ${summary.id}`);
    open.addEventListener("click", () => {
      this.listing.selected = summary.id;
      this.mark();
      void this.detail.open(summary.id);
    });
    const item = el("li", {
      className: "panel-item",
      attributes: { "data-request": summary.id },
      children: [
        el("p", { className: "panel-meta", text: requestHead(summary) }),
        el("strong", { text: requestTitle(summary) }),
        badge(summary),
        open,
      ],
    });
    return item;
  }

  mark(): void {
    for (const item of this.parts.rows.querySelectorAll<HTMLElement>("li[data-request]")) {
      const current = item.dataset["request"] === this.listing.selected;
      item.classList.toggle("panel-item-current", current);
      if (current) {
        item.setAttribute("aria-current", "true");
      } else {
        item.removeAttribute("aria-current");
      }
    }
  }

  update(summary: PanelRequestSummary): void {
    const { rows, filter, status } = this.parts;
    const item = rows.querySelector<HTMLElement>(`li[data-request="${summary.id}"]`);
    if (item === null) {
      return;
    }
    const shown = statusFilter(filter.value);
    if (shown === "all" || shown === summary.status) {
      item.querySelector(".panel-status")?.replaceWith(badge(summary));
      return;
    }
    item.remove();
    speak(status, [listPhrase(rows.children.length, shown, this.listing.cursor !== null)]);
  }
}

export function wireWnioski(section: HTMLElement): void {
  const parts: Parts = {
    rows: areaList(section, "request-rows"),
    more: areaButton(section, "requests-more"),
    refresh: areaButton(section, "requests-refresh"),
    filter: areaSelect(section, "requests-filter"),
    status: area(section, "status"),
  };
  parts.filter.value = statusFilter(new URLSearchParams(location.search).get("status") ?? "");
  const holder: { list?: RequestList } = {};
  const detail = new RequestDetail(detailView(section), (changed) => {
    holder.list?.update(changed);
  });
  const list = new RequestList(parts, detail);
  holder.list = list;
  const view = gateView(section);
  wireShell(view, (role) => {
    if (!canHandleRequests(role)) {
      denyContent(view);
      return;
    }
    void list.load(true);
  });
}

const section = document.querySelector<HTMLElement>('[data-panel-page="requests"]');

if (section !== null) {
  wireWnioski(section);
}
