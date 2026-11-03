import {
  QUESTION_ADDRESSEE_LABELS,
  QUESTION_MAX_LENGTH,
  ANSWER_MAX_LENGTH,
  questionStatusSchema,
  type PanelQuestionDetail,
  type PanelQuestionsList,
  type PanelQuestionSummary,
  type QuestionDecision,
  type QuestionStatus,
} from "@zsm3/contracts/questions";

import { CONNECTION_PHRASE, CONNECTION_STATUS, problemPhrase } from "./api.ts";
import { panelMoment as moment } from "./audit.ts";
import { QUESTION_ROLES } from "./gate.ts";
import { longDate } from "../calendar.ts";

export const QUESTION_STATUS_LABELS: Readonly<Record<QuestionStatus, string>> = {
  received: "Nowe",
  draft: "Szkic odpowiedzi",
  published: "Opublikowane",
  rejected: "Odrzucone",
  withdrawn: "Wycofane",
};

export type QuestionFilter = QuestionStatus | "all";

export interface QuestionsCursor {
  readonly before: string;
  readonly beforeId: string;
}

export interface DecisionSpec {
  readonly action: QuestionDecision;
  readonly label: string;
  readonly warning: string;
  readonly confirm: string;
}

const DECISIONS: Readonly<Record<QuestionDecision, Omit<DecisionSpec, "action">>> = {
  publish: {
    label: "Opublikuj pytanie i odpowiedź",
    warning:
      "Zapisany szkic pytania i odpowiedź będą widoczne dla wszystkich na stronie /skrzynka. Oryginalna treść pytania zostanie usunięta. Upewnij się, że nie ma w nich danych, po których można kogoś rozpoznać.",
    confirm: "Tak, opublikuj",
  },
  reject: {
    label: "Odrzuć pytanie",
    warning:
      "Pytanie nie zostanie opublikowane. Odrzucone pytanie zostanie usunięte automatycznie po 30 dniach.",
    confirm: "Tak, odrzuć",
  },
  withdraw: {
    label: "Wycofaj publikację",
    warning:
      "Pytanie i odpowiedź znikną ze strony. Szkic zostanie w panelu i będzie można go poprawić albo odrzucić.",
    confirm: "Tak, wycofaj",
  },
  delete: {
    label: "Usuń na stałe",
    warning: "Pytanie i szkic odpowiedzi zostaną usunięte z panelu. Tej zmiany nie można cofnąć.",
    confirm: "Tak, usuń na stałe",
  },
};

const DECISIONS_BY_STATUS: Readonly<Record<QuestionStatus, readonly QuestionDecision[]>> = {
  received: ["reject", "delete"],
  draft: ["publish", "reject", "delete"],
  published: ["withdraw"],
  rejected: ["delete"],
  withdrawn: ["reject", "delete"],
};

const DONE: Readonly<Record<QuestionDecision, string>> = {
  publish: "Opublikowano pytanie i odpowiedź.",
  reject: "Odrzucono pytanie. Nie będzie opublikowane.",
  withdraw: "Wycofano publikację. Pytanie nie jest już widoczne na stronie.",
  delete: "Usunięto pytanie na stałe.",
};

const HISTORY_ACTIONS: Readonly<Record<string, string>> = {
  "questions.draft": "zapisano szkic",
  "questions.publish": "opublikowano",
  "questions.reject": "odrzucono",
  "questions.withdraw": "wycofano publikację",
  "questions.delete": "usunięto",
};

export function canModerate(role: string): boolean {
  return QUESTION_ROLES.some((allowed) => allowed === role);
}

export function questionFilter(value: string): QuestionFilter {
  const parsed = questionStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "all";
}

export function questionsPath(filter: QuestionFilter, cursor: QuestionsCursor | null): string {
  const query = new URLSearchParams();
  if (filter !== "all") {
    query.set("status", filter);
  }
  if (cursor !== null) {
    query.set("before", cursor.before);
    query.set("beforeId", cursor.beforeId);
  }
  const search = query.toString();
  return search === "" ? "/api/panel/questions" : `/api/panel/questions?${search}`;
}

export function questionPath(id: string, suffix = ""): string {
  return `/api/panel/questions/${encodeURIComponent(id)}${suffix}`;
}

export function nextQuestionsCursor(list: PanelQuestionsList): QuestionsCursor | null {
  return list.nextBefore === null || list.nextBeforeId === null
    ? null
    : { before: list.nextBefore, beforeId: list.nextBeforeId };
}

export function questionHead(summary: PanelQuestionSummary): string {
  return `${QUESTION_ADDRESSEE_LABELS[summary.addressee]} · wpłynęło ${longDate(summary.receivedOn)}`;
}

export function decisionActions(status: QuestionStatus): readonly DecisionSpec[] {
  return DECISIONS_BY_STATUS[status].map((action) => ({ action, ...DECISIONS[action] }));
}

export function canEditDraft(status: QuestionStatus): boolean {
  return status === "received" || status === "draft" || status === "withdrawn";
}

export interface DraftSeed {
  readonly question: string;
  readonly answer: string;
}

export function draftSeed(detail: PanelQuestionDetail): DraftSeed {
  return detail.draft ?? { question: detail.question ?? "", answer: "" };
}

export function originalNotice(detail: PanelQuestionDetail): string | null {
  return detail.question === null
    ? "Oryginalna treść pytania została usunięta przy publikacji. Zostaje tylko szkic."
    : null;
}

export function historyLine(entry: PanelQuestionDetail["history"][number]): string {
  const action = HISTORY_ACTIONS[entry.action] ?? entry.action;
  return `${moment(entry.at)} — ${action} — ${entry.actorEmail ?? "system"}`;
}

export function listPhrase(count: number, filter: QuestionFilter, more = false): string {
  if (count === 0 && more) {
    return "Na liście nie ma już pytań. Starsze wczytasz przyciskiem „Pokaż starsze”.";
  }
  if (count === 0) {
    return filter === "all"
      ? "Nie ma żadnych pytań."
      : `Brak pytań o statusie „${QUESTION_STATUS_LABELS[filter]}”.`;
  }
  return `Pytań na liście: ${String(count)}.`;
}

export function readPhrase(status: number): string {
  return status === CONNECTION_STATUS ? CONNECTION_PHRASE : problemPhrase(status);
}

export function draftPhrase(status: number): string {
  if (status === 200) {
    return "Zapisano szkic. Nic nie zostało opublikowane.";
  }
  if (status === 422) {
    return `Sprawdź treść: pytanie od 10 do ${String(QUESTION_MAX_LENGTH)} znaków, odpowiedź do ${String(ANSWER_MAX_LENGTH)} znaków, bez znaków sterujących.`;
  }
  return readPhrase(status);
}

export function decisionPhrase(status: number, action: QuestionDecision): string {
  if (status === 200) {
    return DONE[action];
  }
  if (status === 409) {
    return "Ktoś inny zmienił to pytanie w międzyczasie. Wczytano aktualny stan — sprawdź go i zdecyduj ponownie.";
  }
  if (status === 422 && action === "publish") {
    return "Aby opublikować, zapisz szkic z treścią pytania i niepustą odpowiedzią.";
  }
  if (status === 422) {
    return "Tej czynności nie można wykonać w obecnym stanie pytania. Wczytano aktualny stan.";
  }
  return readPhrase(status);
}

export const UNSAVED_PHRASE =
  "Masz niezapisane zmiany w szkicu. Zapisz szkic, zanim go opublikujesz.";
