import "../../lib/panel/zod-jitless.ts";
import { panelShortLinksListSchema, type PanelShortLinkItem } from "@zsm3/contracts/panel";

import { area, areaButton, areaList, button, el, speak } from "./dom.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { copyLink, wireLinkForm } from "./linki-form.ts";
import { wireShell } from "./shell.ts";
import { panelDelete, panelRead, problemPhrase } from "../../lib/panel/api.ts";
import { canEditContent } from "../../lib/panel/gate.ts";
import { parse } from "../../lib/panel/models.ts";
import {
  destinationPhrase,
  LINK_STATUS_LABELS,
  linkMeta,
  linksPath,
  linkStatus,
  listPhrase,
  revokePath,
  revokePhrase,
  shortUrl,
  type LinksCursor,
} from "../../lib/panel/short-links.ts";

interface ListParts {
  readonly rows: HTMLUListElement;
  readonly more: HTMLButtonElement;
  readonly refresh: HTMLButtonElement;
  readonly status: HTMLElement;
  readonly confirm: HTMLElement;
  readonly confirmText: HTMLElement;
  readonly confirmYes: HTMLButtonElement;
  readonly confirmNo: HTMLButtonElement;
}

interface Pending {
  readonly item: PanelShortLinkItem;
  readonly opener: HTMLButtonElement;
}

function listParts(section: HTMLElement): ListParts {
  return {
    rows: areaList(section, "link-rows"),
    more: areaButton(section, "links-more"),
    refresh: areaButton(section, "links-refresh"),
    status: area(section, "status"),
    confirm: area(section, "link-confirm"),
    confirmText: area(section, "link-confirm-text"),
    confirmYes: areaButton(section, "link-confirm-yes"),
    confirmNo: areaButton(section, "link-confirm-no"),
  };
}

function urlOf(item: PanelShortLinkItem): string {
  return shortUrl(window.location.origin, item.code);
}

class LinkList {
  private generation = 0;

  private cursor: LinksCursor | null = null;

  private pending: Pending | undefined;

  private readonly parts: ListParts;

  constructor(parts: ListParts) {
    this.parts = parts;
    parts.refresh.addEventListener("click", () => void this.load(true));
    parts.more.addEventListener("click", () => void this.load(false));
    parts.confirmYes.addEventListener("click", () => void this.revoke());
    parts.confirmNo.addEventListener("click", () => {
      this.cancel();
    });
    parts.confirm.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.cancel();
      }
    });
  }

  async load(reset: boolean): Promise<void> {
    const { parts } = this;
    this.generation += 1;
    const generation = this.generation;
    parts.more.disabled = true;
    parts.rows.setAttribute("aria-busy", "true");
    speak(parts.status, ["Wczytuję linki…"]);
    const response = await panelRead(linksPath(reset ? null : this.cursor));
    if (generation !== this.generation) {
      return;
    }
    parts.more.disabled = false;
    parts.rows.removeAttribute("aria-busy");
    const list = parse(panelShortLinksListSchema, response.data);
    if (list === undefined) {
      speak(parts.status, [problemPhrase(response.status)]);
      return;
    }
    if (reset) {
      this.hideConfirm();
      parts.rows.replaceChildren();
    }
    parts.rows.append(...list.items.map((item) => this.row(item)));
    this.cursor = list.nextCursor;
    parts.more.hidden = this.cursor === null;
    speak(parts.status, [listPhrase(parts.rows.children.length, this.cursor !== null)]);
  }

  prepend(item: PanelShortLinkItem): void {
    this.parts.rows.prepend(this.row(item));
    speak(this.parts.status, [listPhrase(this.parts.rows.children.length, this.cursor !== null)]);
  }

  private row(item: PanelShortLinkItem): HTMLElement {
    const status = linkStatus(item, new Date());
    const copy = button("Kopiuj link");
    copy.setAttribute("aria-label", `Kopiuj link ${urlOf(item)}`);
    copy.addEventListener("click", () => void copyLink(urlOf(item), null, this.parts.status));
    const actions = el("div", { className: "panel-actions", children: [copy] });
    if (status === "active") {
      const revoke = button("Unieważnij", "panel-danger");
      revoke.setAttribute("aria-label", `Unieważnij link ${urlOf(item)}`);
      revoke.addEventListener("click", () => {
        this.ask(item, revoke);
      });
      actions.append(revoke);
    }
    return el("li", {
      className: "panel-item panel-link",
      attributes: { "data-link": item.code },
      children: [
        el("strong", { className: "panel-link-url", text: urlOf(item) }),
        el("span", {
          className: "panel-status",
          text: LINK_STATUS_LABELS[status],
          attributes: { "data-status": status },
        }),
        el("p", { className: "panel-link-target", text: destinationPhrase(item) }),
        el("p", { className: "panel-meta", text: linkMeta(item) }),
        actions,
      ],
    });
  }

  private ask(item: PanelShortLinkItem, opener: HTMLButtonElement): void {
    const { parts } = this;
    this.pending = { item, opener };
    parts.confirmText.textContent = `Unieważnić link ${urlOf(item)}? Przestanie działać od razu, także dla osób, które już go mają. Tego nie da się cofnąć.`;
    opener.closest("li")?.append(parts.confirm);
    parts.confirm.hidden = false;
    parts.confirmYes.disabled = false;
    parts.confirmYes.focus();
  }

  private hideConfirm(): void {
    this.parts.confirm.hidden = true;
    this.parts.rows.after(this.parts.confirm);
  }

  private cancel(): void {
    const opener = this.pending?.opener;
    this.pending = undefined;
    this.hideConfirm();
    opener?.focus();
  }

  private async revoke(): Promise<void> {
    const { parts, pending } = this;
    if (pending === undefined) {
      return;
    }
    parts.confirmYes.disabled = true;
    const response = await panelDelete(revokePath(pending.item.code));
    this.pending = undefined;
    this.hideConfirm();
    speak(parts.status, [revokePhrase(response.status)]);
    if (response.status !== 204) {
      pending.opener.focus();
      return;
    }
    const updated = this.row({ ...pending.item, revokedAt: new Date().toISOString() });
    pending.opener.closest("li")?.replaceWith(updated);
    updated.querySelector("button")?.focus();
  }
}

export function wireLinki(section: HTMLElement): void {
  const list = new LinkList(listParts(section));
  const view = gateView(section);
  wireShell(view, (role) => {
    if (!canEditContent(role)) {
      denyContent(view);
      return;
    }
    wireLinkForm(section, (item) => {
      list.prepend(item);
    });
    void list.load(true);
  });
}

const section = document.querySelector<HTMLElement>('[data-panel-page="links"]');

if (section !== null) {
  wireLinki(section);
}
