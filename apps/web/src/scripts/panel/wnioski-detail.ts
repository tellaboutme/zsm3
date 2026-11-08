import type { PanelRequestTransition } from "@zsm3/contracts/panel-requests";
import type { PanelRequestDetail } from "@zsm3/contracts/requests";

import { button, speak } from "./dom.ts";
import { clearDetail, fetchDetail, renderFacts, type DetailView } from "./wnioski-view.ts";
import { panelSend, problemPhrase } from "../../lib/panel/api.ts";
import {
  STALE_DETAIL_PHRASE,
  requestTitle,
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

  private readonly saving = new Set<string>();

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
      speak(view.feedback, [problemPhrase(result.status)]);
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
    this.lock();
    this.changed(detail);
  }

  private actionButton(action: StaffAction): HTMLButtonElement {
    const node = button(action.label, action.to === "rejected" ? "panel-danger" : undefined);
    node.dataset["to"] = action.to;
    node.addEventListener("click", () => {
      if (action.warning === null) {
        this.close();
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
    view.confirmYes.textContent = action.confirm;
    view.confirm.hidden = false;
    view.confirmYes.focus();
  }

  private cancel(): void {
    if (this.isSaving()) {
      return;
    }
    const back = this.shown.returnTo;
    this.close();
    back?.focus();
  }

  private close(): void {
    const { view, shown } = this;
    shown.pending = undefined;
    shown.returnTo = undefined;
    view.confirm.hidden = true;
  }

  private isSaving(): boolean {
    const id = this.shown.detail?.id;
    return id !== undefined && this.saving.has(id);
  }

  private lock(): void {
    const { view } = this;
    const on = this.isSaving();
    view.confirmYes.disabled = on;
    view.confirmNo.disabled = on;
    for (const node of view.actions.querySelectorAll("button")) {
      node.disabled = on;
    }
  }

  private async apply(action: StaffAction): Promise<void> {
    const seen = this.shown.detail;
    if (seen === undefined) {
      return;
    }
    this.saving.add(seen.id);
    this.lock();
    const status = await this.send(seen, action);
    const phrases = [transitionPhrase(status, action.to)];
    this.saving.delete(seen.id);
    if (!(await this.reload(seen.id))) {
      phrases.push(STALE_DETAIL_PHRASE);
    }
    this.lock();
    if (this.shown.wanted === seen.id) {
      speak(this.view.feedback, phrases);
    }
  }

  private async send(seen: PanelRequestDetail, action: StaffAction): Promise<number> {
    const path = `/api/panel/requests/${encodeURIComponent(seen.id)}/status`;
    const body: PanelRequestTransition = { to: action.to, expectedStatus: seen.status };
    const response = await panelSend("POST", path, body);
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
