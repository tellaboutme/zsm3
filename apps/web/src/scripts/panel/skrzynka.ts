import "../../lib/panel/zod-jitless.ts";
import {
  panelQuestionsListSchema,
  type PanelQuestionDetail,
  type PanelQuestionSummary,
} from "@zsm3/contracts/questions";

import { area, areaButton, areaList, areaSelect, button, el, speak } from "./dom.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { QuestionDetail } from "./skrzynka-detail.ts";
import { questionView } from "./skrzynka-view.ts";
import { panelRead } from "../../lib/panel/api.ts";
import { parse } from "../../lib/panel/models.ts";
import {
  QUESTION_STATUS_LABELS,
  canModerate,
  listPhrase,
  nextQuestionsCursor,
  questionFilter,
  questionHead,
  questionsPath,
  readPhrase,
  type QuestionsCursor,
} from "../../lib/panel/questions.ts";

interface Parts {
  readonly rows: HTMLUListElement;
  readonly more: HTMLButtonElement;
  readonly refresh: HTMLButtonElement;
  readonly filter: HTMLSelectElement;
  readonly status: HTMLElement;
}

interface Listing {
  generation: number;
  cursor: QuestionsCursor | null;
  selected: string | undefined;
}

function badge(summary: PanelQuestionSummary): HTMLElement {
  return el("span", {
    className: "panel-status",
    text: QUESTION_STATUS_LABELS[summary.status],
    attributes: { "data-status": summary.status },
  });
}

class QuestionList {
  private readonly listing: Listing = { generation: 0, cursor: null, selected: undefined };

  private readonly parts: Parts;

  private readonly detail: QuestionDetail;

  constructor(parts: Parts, detail: QuestionDetail) {
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
    const filter = questionFilter(parts.filter.value);
    parts.more.disabled = true;
    parts.rows.setAttribute("aria-busy", "true");
    speak(parts.status, ["Wczytuję pytania…"]);
    const response = await panelRead(questionsPath(filter, reset ? null : listing.cursor));
    if (generation !== listing.generation) return;
    parts.more.disabled = false;
    parts.rows.removeAttribute("aria-busy");
    const list = parse(panelQuestionsListSchema, response.data);
    if (reset) {
      parts.rows.replaceChildren();
      listing.cursor = null;
      parts.more.hidden = true;
    }
    if (list === undefined) {
      speak(parts.status, [readPhrase(response.status)]);
      return;
    }
    parts.rows.append(...list.items.map((item) => this.row(item)));
    listing.cursor = nextQuestionsCursor(list);
    parts.more.hidden = listing.cursor === null;
    this.mark();
    speak(parts.status, [listPhrase(parts.rows.children.length, filter)]);
  }

  private row(summary: PanelQuestionSummary): HTMLElement {
    const open = button("Otwórz", "panel-open");
    open.setAttribute("aria-label", `Otwórz pytanie: ${questionHead(summary)}`);
    open.addEventListener("click", () => {
      this.listing.selected = summary.id;
      this.mark();
      void this.detail.open(summary.id);
    });
    return el("li", {
      className: "panel-item",
      attributes: { "data-question": summary.id },
      children: [
        el("p", { className: "panel-meta", text: questionHead(summary) }),
        badge(summary),
        open,
      ],
    });
  }

  private mark(): void {
    for (const item of this.parts.rows.querySelectorAll<HTMLElement>("li[data-question]")) {
      const current = item.dataset["question"] === this.listing.selected;
      item.classList.toggle("panel-item-current", current);
      if (current) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
    }
  }

  update(changed: PanelQuestionDetail | string): void {
    const { rows, filter, status } = this.parts;
    const id = typeof changed === "string" ? changed : changed.id;
    const item = rows.querySelector<HTMLElement>(`li[data-question="${id}"]`);
    if (item === null) return;
    const shown = questionFilter(filter.value);
    if (typeof changed !== "string" && (shown === "all" || shown === changed.status)) {
      item.querySelector(".panel-status")?.replaceWith(badge(changed));
      return;
    }
    item.remove();
    speak(status, [listPhrase(rows.children.length, shown, this.listing.cursor !== null)]);
  }
}

export function wireSkrzynka(section: HTMLElement): void {
  const parts: Parts = {
    rows: areaList(section, "question-rows"),
    more: areaButton(section, "questions-more"),
    refresh: areaButton(section, "questions-refresh"),
    filter: areaSelect(section, "questions-filter"),
    status: area(section, "status"),
  };
  const holder: { list?: QuestionList } = {};
  const detail = new QuestionDetail(questionView(section), (changed) => {
    holder.list?.update(changed);
  });
  const list = new QuestionList(parts, detail);
  holder.list = list;
  const view = gateView(section);
  wireShell(view, (role) => {
    if (!canModerate(role)) {
      denyContent(view);
      return;
    }
    void list.load(true);
  });
}

const section = document.querySelector<HTMLElement>('[data-panel-page="questions"]');

if (section !== null) {
  wireSkrzynka(section);
}
