import { panelQuestionDetailSchema, type PanelQuestionDetail } from "@zsm3/contracts/questions";

import { area, areaButton, areaForm, areaInput, el, speak } from "./dom.ts";
import { panelRead } from "../../lib/panel/api.ts";
import { parse } from "../../lib/panel/models.ts";
import {
  PRIVACY_HINTS_NONE,
  PRIVACY_REVIEW_MISSING,
  privacyHints,
} from "../../lib/panel/question-privacy.ts";
import {
  QUESTION_STATUS_LABELS,
  historyLine,
  originalNotice,
  questionHead,
  questionPath,
  type DecisionSpec,
} from "../../lib/panel/questions.ts";

const UNEXPECTED_STATUS = 500;

export interface QuestionView {
  readonly root: HTMLElement;
  readonly title: HTMLElement;
  readonly meta: HTMLElement;
  readonly feedback: HTMLElement;
  readonly erased: HTMLElement;
  readonly original: HTMLElement;
  readonly publicRow: HTMLElement;
  readonly publicLink: HTMLAnchorElement;
  readonly editor: HTMLFormElement;
  readonly draftQuestion: HTMLTextAreaElement;
  readonly draftAnswer: HTMLTextAreaElement;
  readonly save: HTMLButtonElement;
  readonly actions: HTMLElement;
  readonly confirm: HTMLElement;
  readonly confirmText: HTMLElement;
  readonly confirmHints: HTMLElement;
  readonly confirmReview: HTMLElement;
  readonly confirmCheck: HTMLInputElement;
  readonly confirmYes: HTMLButtonElement;
  readonly confirmNo: HTMLButtonElement;
  readonly history: HTMLElement;
}

function textArea(form: HTMLFormElement, name: string): HTMLTextAreaElement {
  const node = form.elements.namedItem(name);
  if (node instanceof HTMLTextAreaElement) {
    return node;
  }
  throw new Error(`missing textarea ${name}`);
}

function link(root: HTMLElement, name: string): HTMLAnchorElement {
  const node = area(root, name);
  if (node instanceof HTMLAnchorElement) {
    return node;
  }
  throw new Error(`missing link ${name}`);
}

export function questionView(section: HTMLElement): QuestionView {
  const editor = areaForm(section, "question-editor");
  return {
    root: area(section, "question-detail"),
    title: area(section, "question-title"),
    meta: area(section, "question-meta"),
    feedback: area(section, "question-feedback"),
    erased: area(section, "question-erased"),
    original: area(section, "question-original"),
    publicRow: area(section, "question-public"),
    publicLink: link(section, "question-public-link"),
    editor,
    draftQuestion: textArea(editor, "draftQuestion"),
    draftAnswer: textArea(editor, "draftAnswer"),
    save: areaButton(section, "question-save"),
    actions: area(section, "question-actions"),
    confirm: area(section, "question-confirm"),
    confirmText: area(section, "confirm-text"),
    confirmHints: area(section, "confirm-hints"),
    confirmReview: area(section, "confirm-review"),
    confirmCheck: areaInput(section, "confirm-check"),
    confirmYes: areaButton(section, "confirm-yes"),
    confirmNo: areaButton(section, "confirm-no"),
    history: area(section, "question-history"),
  };
}

export async function fetchQuestion(
  id: string,
): Promise<{ status: number; detail?: PanelQuestionDetail }> {
  const response = await panelRead(questionPath(id));
  const detail = parse(panelQuestionDetailSchema, response.data);
  if (detail === undefined) {
    return { status: response.ok ? UNEXPECTED_STATUS : response.status };
  }
  return { status: 200, detail };
}

export function clearQuestion(view: QuestionView): void {
  const { title, meta, erased, original, publicRow, editor, actions, confirm, history } = view;
  title.textContent = "Pytanie";
  meta.textContent = "";
  erased.hidden = true;
  original.replaceChildren();
  publicRow.hidden = true;
  editor.hidden = true;
  editor.reset();
  actions.replaceChildren();
  confirm.hidden = true;
  history.replaceChildren();
}

export function renderQuestion(view: QuestionView, detail: PanelQuestionDetail): void {
  const { title, meta, erased, original, publicRow, publicLink, history } = view;
  title.textContent = `Pytanie — ${questionHead(detail)}`;
  meta.textContent = `Status: ${QUESTION_STATUS_LABELS[detail.status]}`;
  const notice = originalNotice(detail);
  erased.hidden = notice === null;
  erased.textContent = notice ?? "";
  original.textContent = detail.question ?? "";
  publicRow.hidden = detail.published === null;
  publicLink.href = detail.published === null ? "/skrzynka" : `/skrzynka/${detail.published.slug}`;
  history.replaceChildren(
    ...(detail.history.length === 0
      ? [el("li", { text: "Brak zmian." })]
      : detail.history.map((entry) => el("li", { text: historyLine(entry) }))),
  );
}

export function showConfirm(
  view: QuestionView,
  spec: DecisionSpec,
  draft: PanelQuestionDetail["draft"],
): void {
  const { confirm, confirmText, confirmYes, confirmHints, confirmReview, confirmCheck } = view;
  const reviewing = spec.action === "publish";
  const hints = draft === null ? [] : privacyHints(draft.question, draft.answer);
  confirmText.textContent = spec.warning;
  confirmYes.textContent = spec.confirm;
  confirmHints.hidden = !reviewing;
  confirmHints.replaceChildren(
    ...(hints.length === 0 ? [PRIVACY_HINTS_NONE] : hints).map((text) => el("li", { text })),
  );
  confirmReview.hidden = !reviewing;
  confirmCheck.checked = false;
  confirm.hidden = false;
}

export function reviewed(view: QuestionView, spec: DecisionSpec): boolean {
  if (spec.action !== "publish" || view.confirmCheck.checked) {
    return true;
  }
  speak(view.feedback, [PRIVACY_REVIEW_MISSING]);
  view.confirmCheck.focus();
  return false;
}
