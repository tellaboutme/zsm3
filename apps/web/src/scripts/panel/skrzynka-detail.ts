import type {
  PanelQuestionDecision,
  PanelQuestionDetail,
  PanelQuestionDraftSave,
} from "@zsm3/contracts/questions";

import { button, speak } from "./dom.ts";
import {
  clearQuestion,
  fetchQuestion,
  renderQuestion,
  type QuestionView,
} from "./skrzynka-view.ts";
import { panelSend } from "../../lib/panel/api.ts";
import {
  UNSAVED_PHRASE,
  canEditDraft,
  decisionActions,
  decisionPhrase,
  draftPhrase,
  draftSeed,
  questionPath,
  readPhrase,
  type DecisionSpec,
} from "../../lib/panel/questions.ts";

export type QuestionChanged = (detail: PanelQuestionDetail | string) => void;

interface Shown {
  wanted: string | undefined;
  detail: PanelQuestionDetail | undefined;
  pending: DecisionSpec | undefined;
  returnTo: HTMLButtonElement | undefined;
  dirty: boolean;
  busy: boolean;
}

export class QuestionDetail {
  private readonly shown: Shown = {
    wanted: undefined,
    detail: undefined,
    pending: undefined,
    returnTo: undefined,
    dirty: false,
    busy: false,
  };

  private readonly view: QuestionView;

  private readonly changed: QuestionChanged;

  constructor(view: QuestionView, changed: QuestionChanged) {
    this.view = view;
    this.changed = changed;
    for (const field of [view.draftQuestion, view.draftAnswer]) {
      field.addEventListener("input", () => {
        this.shown.dirty = true;
      });
    }
    view.editor.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.saveDraft();
    });
    view.confirmNo.addEventListener("click", () => {
      this.cancel();
    });
    view.confirm.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.cancel();
    });
    view.confirmYes.addEventListener("click", () => {
      const pending = this.shown.pending;
      if (pending !== undefined) void this.decide(pending);
    });
  }

  async open(id: string): Promise<void> {
    const { view, shown } = this;
    shown.wanted = id;
    this.forget();
    view.root.hidden = false;
    speak(view.feedback, ["Wczytuję pytanie…"]);
    if (await this.reload(id)) {
      speak(view.feedback, []);
    }
  }

  private forget(): void {
    const { shown } = this;
    shown.detail = undefined;
    shown.pending = undefined;
    shown.returnTo = undefined;
    shown.dirty = false;
    clearQuestion(this.view);
  }

  private render(detail: PanelQuestionDetail): void {
    const { view, shown } = this;
    this.forget();
    shown.detail = detail;
    renderQuestion(view, detail);
    const seed = draftSeed(detail);
    view.editor.hidden = !canEditDraft(detail.status);
    view.draftQuestion.value = seed.question;
    view.draftAnswer.value = seed.answer;
    view.actions.replaceChildren(
      ...decisionActions(detail.status).map((spec) => this.actionButton(spec)),
    );
    this.lock();
    this.changed(detail);
  }

  private actionButton(spec: DecisionSpec): HTMLButtonElement {
    const node = button(spec.label, spec.action === "publish" ? undefined : "panel-danger");
    node.dataset["action"] = spec.action;
    node.addEventListener("click", () => {
      if (spec.action === "publish" && this.shown.dirty) {
        speak(this.view.feedback, [UNSAVED_PHRASE]);
        return;
      }
      this.ask(spec, node);
    });
    return node;
  }

  private ask(spec: DecisionSpec, from: HTMLButtonElement): void {
    const { view, shown } = this;
    shown.pending = spec;
    shown.returnTo = from;
    view.confirmText.textContent = spec.warning;
    view.confirmYes.textContent = spec.confirm;
    view.confirm.hidden = false;
    view.confirmYes.focus();
  }

  private cancel(): void {
    if (this.shown.busy) return;
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

  private lock(): void {
    const { view, shown } = this;
    for (const node of [view.confirmYes, view.confirmNo, view.save]) node.disabled = shown.busy;
    for (const node of view.actions.querySelectorAll("button")) node.disabled = shown.busy;
  }

  private async saveDraft(): Promise<void> {
    const seen = this.shown.detail;
    if (seen === undefined || this.shown.busy) return;
    const body: PanelQuestionDraftSave = {
      expectedVersion: seen.version,
      question: this.view.draftQuestion.value,
      answer: this.view.draftAnswer.value,
    };
    const status = await this.send("PUT", questionPath(seen.id, "/draft"), body);
    if (status === 200) {
      this.shown.dirty = false;
      await this.reload(seen.id);
    }
    speak(this.view.feedback, [draftPhrase(status)]);
  }

  private async decide(spec: DecisionSpec): Promise<void> {
    const seen = this.shown.detail;
    if (seen === undefined) return;
    this.close();
    const body: PanelQuestionDecision = { action: spec.action, expectedVersion: seen.version };
    const status = await this.send("POST", questionPath(seen.id, "/decision"), body);
    const phrases = [decisionPhrase(status, spec.action)];
    if (status === 200 && spec.action === "delete") {
      this.forget();
      this.view.root.hidden = true;
      this.changed(seen.id);
    } else if (!(await this.reload(seen.id))) {
      phrases.push("Nie udało się wczytać aktualnego stanu. Otwórz pytanie ponownie z listy.");
    }
    speak(this.view.feedback, phrases);
  }

  private async send(method: "PUT" | "POST", path: string, body: unknown): Promise<number> {
    this.shown.busy = true;
    this.lock();
    const response = await panelSend(method, path, body);
    this.shown.busy = false;
    this.lock();
    return response.status;
  }

  private async reload(id: string): Promise<boolean> {
    const result = await fetchQuestion(id);
    if (this.shown.wanted !== id) return false;
    if (result.detail === undefined) {
      this.forget();
      speak(this.view.feedback, [readPhrase(result.status)]);
      return false;
    }
    this.render(result.detail);
    this.view.title.focus();
    return true;
  }
}
