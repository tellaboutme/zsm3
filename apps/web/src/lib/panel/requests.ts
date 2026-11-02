import {
  staffNextStatuses,
  type PanelRequestsList,
  type StaffTargetStatus,
} from "@zsm3/contracts/panel-requests";
import { requestStatusLabels } from "@zsm3/contracts/request-labels";
import {
  documentTypeLabels,
  requestStatusSchema,
  type PanelRequestDetail,
  type PanelRequestSummary,
  type RequestStatus,
} from "@zsm3/contracts/requests";

import { CONNECTION_PHRASE, CONNECTION_STATUS, problemPhrase } from "./api.ts";
import { panelMoment as moment } from "./audit.ts";
import { REQUEST_ROLES } from "./gate.ts";

export const REQUEST_STATUS_LABELS: Readonly<Record<RequestStatus, string>> = requestStatusLabels;

export const STALE_DETAIL_PHRASE =
  "Nie udało się wczytać aktualnego stanu wniosku. Otwórz go ponownie z listy.";

export interface RequestsCursor {
  readonly before: string;
  readonly beforeId: string | null;
}

export type StatusFilter = RequestStatus | "all";

export interface StaffAction {
  readonly to: StaffTargetStatus;
  readonly label: string;
  readonly confirm: string;
  readonly warning: string | null;
}

export type PiiState = "present" | "erased" | "unreadable";

export interface Fact {
  readonly label: string;
  readonly value: string;
}

const ACTIONS: Readonly<Record<StaffTargetStatus, Omit<StaffAction, "to">>> = {
  in_progress: { label: "Przyjmij do realizacji", confirm: "", warning: null },
  ready: {
    label: "Oznacz jako gotowy do odbioru",
    confirm: "Tak, oznacz jako gotowy",
    warning: "Wnioskodawca dostanie e-mail, że dokument czeka w sekretariacie.",
  },
  collected: {
    label: "Potwierdź odbiór",
    confirm: "Tak, potwierdź odbiór",
    warning: "Wniosek zostanie zamknięty. Tej zmiany nie można cofnąć.",
  },
  rejected: {
    label: "Odrzuć wniosek",
    confirm: "Tak, odrzuć wniosek",
    warning:
      "Wnioskodawca dostanie e-mail o odrzuceniu. Wniosek zostanie zamknięty i tej zmiany nie można cofnąć.",
  },
};

export function statusFilter(value: string): StatusFilter {
  const parsed = requestStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "all";
}

export function requestsPath(filter: StatusFilter, cursor: RequestsCursor | null): string {
  const query = new URLSearchParams();
  if (filter !== "all") {
    query.set("status", filter);
  }
  if (cursor !== null) {
    query.set("before", cursor.before);
    if (cursor.beforeId !== null) {
      query.set("beforeId", cursor.beforeId);
    }
  }
  const search = query.toString();
  return search === "" ? "/api/panel/requests" : `/api/panel/requests?${search}`;
}

export function nextCursor(list: PanelRequestsList): RequestsCursor | null {
  if (list.nextBefore === null) {
    return null;
  }
  return { before: list.nextBefore, beforeId: list.nextBeforeId };
}

export function requestTitle(request: PanelRequestSummary): string {
  return documentTypeLabels[request.type];
}

export function requestHead(request: PanelRequestSummary): string {
  return `${moment(request.createdAt)} · nr ${request.id}`;
}

export function staffActions(status: RequestStatus): readonly StaffAction[] {
  return staffNextStatuses(status).map((to) => ({ to, ...ACTIONS[to] }));
}

export function piiState(detail: PanelRequestDetail): PiiState {
  if (detail.piiErasedAt !== null) {
    return "erased";
  }
  return detail.firstName === null || detail.email === null ? "unreadable" : "present";
}

export function piiNotice(detail: PanelRequestDetail): string | null {
  const erasedAt = detail.piiErasedAt;
  if (erasedAt !== null) {
    return `Dane osobowe usunięto ${moment(erasedAt)} (wycofanie wniosku albo koniec okresu przechowywania).`;
  }
  if (piiState(detail) === "unreadable") {
    return "Nie udało się odczytać danych osobowych tego wniosku. Zgłoś to administratorowi panelu.";
  }
  return null;
}

function personalFacts(detail: PanelRequestDetail): readonly Fact[] {
  const { firstName, lastName, email } = detail;
  if (detail.piiErasedAt !== null || firstName === null || email === null) {
    return [];
  }
  const facts: readonly (Fact | null)[] = [
    { label: "Imię i nazwisko", value: lastName === null ? firstName : `${firstName} ${lastName}` },
    { label: "E-mail", value: email },
    detail.className === null ? null : { label: "Klasa", value: detail.className },
    detail.graduationYear === null
      ? null
      : { label: "Rok ukończenia szkoły", value: String(detail.graduationYear) },
    detail.note === null ? null : { label: "Uwagi wnioskodawcy", value: detail.note },
  ];
  return facts.filter((fact): fact is Fact => fact !== null);
}

export function requestFacts(detail: PanelRequestDetail): readonly Fact[] {
  return [
    { label: "Status", value: REQUEST_STATUS_LABELS[detail.status] },
    { label: "Złożony", value: moment(detail.createdAt) },
    { label: "Ostatnia zmiana", value: moment(detail.updatedAt) },
    ...personalFacts(detail),
  ];
}

export function listPhrase(count: number, filter: StatusFilter, more = false): string {
  if (count === 0 && more) {
    return "Na liście nie ma już wniosków. Starsze wczytasz przyciskiem „Pokaż starsze”.";
  }
  if (count === 0) {
    return filter === "all"
      ? "Nie ma jeszcze żadnych wniosków."
      : `Brak wniosków o statusie „${REQUEST_STATUS_LABELS[filter]}”.`;
  }
  return `Wniosków na liście: ${String(count)}.`;
}

export function transitionPhrase(status: number, to: StaffTargetStatus): string {
  if (status === 200) {
    return `Zapisano. Nowy status: ${REQUEST_STATUS_LABELS[to]}.`;
  }
  if (status === 409) {
    return "Ktoś inny zmienił ten wniosek w międzyczasie. Wczytano aktualny stan — sprawdź go i zdecyduj ponownie.";
  }
  if (status === 422) {
    return "Tej zmiany nie można wykonać z obecnego statusu. Wczytano aktualny stan wniosku.";
  }
  if (status === CONNECTION_STATUS) {
    return `${CONNECTION_PHRASE} Status wniosku mógł się nie zmienić.`;
  }
  return problemPhrase(status);
}

export function readPhrase(status: number): string {
  return status === CONNECTION_STATUS ? CONNECTION_PHRASE : problemPhrase(status);
}

export function canHandleRequests(role: string): boolean {
  return REQUEST_ROLES.some((allowed) => allowed === role);
}
