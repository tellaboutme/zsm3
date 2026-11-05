import {
  panelAdminShortLinksListSchema,
  type PanelAdminShortLinkItem,
} from "@zsm3/contracts/panel";

import { area, areaButton, areaList, button, el, speak } from "./dom.ts";
import { panelDelete, panelRead, problemPhrase } from "../../lib/panel/api.ts";
import { parse } from "../../lib/panel/models.ts";
import {
  adminLinksPath,
  adminListPhrase,
  adminMeta,
  adminRevokePath,
  adminRevokePhrase,
} from "../../lib/panel/short-links-admin.ts";
import { shortUrl, type LinksCursor } from "../../lib/panel/short-links.ts";

interface AdminParts {
  readonly section: HTMLElement;
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
  readonly item: PanelAdminShortLinkItem;
  readonly opener: HTMLButtonElement;
}

function adminParts(page: HTMLElement): AdminParts {
  return {
    section: area(page, "admin-links"),
    rows: areaList(page, "admin-rows"),
    more: areaButton(page, "admin-more"),
    refresh: areaButton(page, "admin-refresh"),
    status: area(page, "admin-status"),
    confirm: area(page, "admin-confirm"),
    confirmText: area(page, "admin-confirm-text"),
    confirmYes: areaButton(page, "admin-confirm-yes"),
    confirmNo: areaButton(page, "admin-confirm-no"),
  };
}

function urlOf(item: PanelAdminShortLinkItem): string {
  return shortUrl(window.location.origin, item.code);
}

export class AdminLinkList {
  private generation = 0;

  private cursor: LinksCursor | null = null;

  private pending: Pending | undefined;

  private readonly parts: AdminParts;

  constructor(page: HTMLElement) {
    const parts = adminParts(page);
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

  show(): void {
    this.parts.section.hidden = false;
    void this.load(true);
  }

  async load(reset: boolean): Promise<void> {
    const { parts } = this;
    this.generation += 1;
    const generation = this.generation;
    parts.more.disabled = true;
    parts.rows.setAttribute("aria-busy", "true");
    speak(parts.status, ["Wczytuję aktywne linki wszystkich pracowników…"]);
    const response = await panelRead(adminLinksPath(reset ? null : this.cursor));
    if (generation !== this.generation) {
      return;
    }
    parts.more.disabled = false;
    parts.rows.removeAttribute("aria-busy");
    const list = parse(panelAdminShortLinksListSchema, response.data);
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
    speak(parts.status, [adminListPhrase(parts.rows.children.length, this.cursor !== null)]);
  }

  private row(item: PanelAdminShortLinkItem): HTMLElement {
    const revoke = button("Unieważnij", "panel-danger");
    revoke.setAttribute("aria-label", `Unieważnij link ${urlOf(item)} autorstwa ${item.owner}`);
    revoke.addEventListener("click", () => {
      this.ask(item, revoke);
    });
    return el("li", {
      className: "panel-item panel-link",
      attributes: { "data-admin-link": item.code },
      children: [
        el("strong", { className: "panel-link-url", text: urlOf(item) }),
        el("p", { className: "panel-meta", text: adminMeta(item) }),
        el("div", { className: "panel-actions", children: [revoke] }),
      ],
    });
  }

  private ask(item: PanelAdminShortLinkItem, opener: HTMLButtonElement): void {
    const { parts } = this;
    this.pending = { item, opener };
    parts.confirmText.textContent = `Unieważnić link ${urlOf(item)} należący do ${item.owner}? Przestanie działać od razu dla wszystkich. Tego nie da się cofnąć, a w dzienniku zostanie zapisane twoje konto.`;
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
    const response = await panelDelete(adminRevokePath(pending.item.code));
    this.pending = undefined;
    this.hideConfirm();
    speak(parts.status, [adminRevokePhrase(response.status)]);
    if (response.status !== 204) {
      pending.opener.focus();
      return;
    }
    const row = pending.opener.closest("li");
    const next = row?.nextElementSibling?.querySelector("button") ?? parts.refresh;
    row?.remove();
    next.focus();
  }
}
