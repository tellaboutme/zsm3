import type { PanelRequestDetail } from "@zsm3/contracts/requests";

import { button, speak } from "./dom.ts";
import { clearDetail, fetchDetail, renderFacts, type DetailView } from "./wnioski-view.ts";
import { panelSend } from "../../lib/panel/api.ts";
import {
  STALE_DETAIL_PHRASE,
  readPhrase,
  requestTitle,
  shouldReload,
  staffActions,
  transitionPhrase,
  type StaffAction,
} from "../../lib/panel/requests.ts";

export type DetailChanged = (detail: PanelRequestDetail) => void;

interface Shown {
  wanted: string | undefined;
  detail: PanelRequestDetail | undefined;
  pending: StaffAction | undefined;
  returnTo: HTMLButtonElement | undefined;
}

export class RequestDetail {
  private readonly shown: Shown = {
    wanted: undefined,
    detail: undefined,
    pending: undefined,
    returnTo: undefined,
  };

  private readonly view: DetailView;

  private readonly changed: DetailChanged;

  constructor(view: DetailView, changed: DetailChanged) {
    this.view = view;
    this.changed = changed;
    view.confirmNo.addEventListener("click", () => {
      this.cancel();
    });
    view.confirm.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.cancel();
      }
    });
    view.confirmYes.addEventListener("click", () => {
      const action = this.shown.pending;
      if (action !== undefined) {
        void this.apply(action);
      }
    });
  }

  async open(id: string): Promise<void> {
    const { view, shown } = this;
    shown.wanted = id;
    this.forget();
    view.root.hidden = false;
    speak(view.feedback, ["Wczytuję wniosek…"]);
    const result = await fetchDetail(id);
    if (shown.wanted !== id) {
      return;
    }
    if (result.detail === undefined) {
      speak(view.feedback, [readPhrase(result.status)]);
      return;
    }
    this.render(result.detail);
    speak(view.feedback, []);
    view.title.focus();
  }

  private forget(): void {
    const { shown } = this;
    shown.detail = undefined;
    shown.pending = undefined;
    shown.returnTo = undefined;
    clearDetail(this.view);
  }

  private render(detail: PanelRequestDetail): void {
    const { view, shown } = this;
    this.forget();
    shown.detail = detail;
    view.title.textContent = requestTitle(detail);
    view.id.textContent = `Wniosek nr ${detail.id}`;
    renderFacts(view, detail);
    view.actions.replaceChildren(...staffActions(detail.status).map((a) => this.actionButton(a)));
    this.changed(detail);
  }

  private actionButton(action: StaffAction): HTMLButtonElement {
    const node = button(action.label, action.to === "rejected" ? "panel-danger" : undefined);
    node.dataset["to"] = action.to;
    node.addEventListener("click", () => {
      if (action.warning === null) {
        void this.apply(action);
        return;
      }
      this.ask(action, node);
    });
    return node;
  }

  private ask(action: StaffAction, from: HTMLButtonElement): void {
    const { view, shown } = this;
    shown.pending = action;
    shown.returnTo = from;
    view.confirmText.textContent = action.warning ?? "";
    view.confirmYes.textContent = action.label;
    view.confirm.hidden = false;
    view.confirmYes.focus();
  }

  private cancel(): void {
    const { view, shown } = this;
    const back = shown.returnTo;
    shown.pending = undefined;
    shown.returnTo = undefined;
    view.confirm.hidden = true;
    back?.focus();
  }

  private busy(on: boolean): void {
    const { view } = this;
    view.confirmYes.disabled = on;
    for (const node of view.actions.querySelectorAll("button")) {
      node.disabled = on;
    }
  }

  private async apply(action: StaffAction): Promise<void> {
    const seen = this.shown.detail;
    if (seen === undefined) {
      return;
    }
    this.busy(true);
    const status = await this.send(seen, action);
    const phrases = [transitionPhrase(status, action.to)];
    if (shouldReload(status) && !(await this.reload(seen.id))) {
      phrases.push(STALE_DETAIL_PHRASE);
    }
    this.busy(false);
    if (this.shown.wanted === seen.id) {
      speak(this.view.feedback, phrases);
    }
  }

  private async send(seen: PanelRequestDetail, action: StaffAction): Promise<number> {
    const fresh = await fetchDetail(seen.id);
    if (fresh.detail === undefined) {
      return fresh.status;
    }
    if (fresh.detail.status !== seen.status || fresh.detail.updatedAt !== seen.updatedAt) {
      return 409;
    }
    const path = `/api/panel/requests/${encodeURIComponent(seen.id)}/status`;
    const response = await panelSend("POST", path, { to: action.to });
    return response.status;
  }

  private async reload(id: string): Promise<boolean> {
    const result = await fetchDetail(id);
    const current = this.shown.wanted === id;
    if (result.detail === undefined) {
      if (current) {
        this.forget();
      }
      return false;
    }
    if (!current) {
      this.changed(result.detail);
      return true;
    }
    this.render(result.detail);
    this.view.title.focus();
    return true;
  }
}
