import { panelRequestDetailSchema, type PanelRequestDetail } from "@zsm3/contracts/requests";

import { area, areaButton, el } from "./dom.ts";
import { panelRead } from "../../lib/panel/api.ts";
import { parse } from "../../lib/panel/models.ts";
import { piiNotice, requestFacts } from "../../lib/panel/requests.ts";

const UNEXPECTED_STATUS = 500;

export interface DetailView {
  readonly root: HTMLElement;
  readonly title: HTMLElement;
  readonly id: HTMLElement;
  readonly pii: HTMLElement;
  readonly facts: HTMLElement;
  readonly feedback: HTMLElement;
  readonly actions: HTMLElement;
  readonly confirm: HTMLElement;
  readonly confirmText: HTMLElement;
  readonly confirmYes: HTMLButtonElement;
  readonly confirmNo: HTMLButtonElement;
}

export function detailView(section: HTMLElement): DetailView {
  return {
    root: area(section, "request-detail"),
    title: area(section, "request-title"),
    id: area(section, "request-id"),
    pii: area(section, "request-pii"),
    facts: area(section, "request-facts"),
    feedback: area(section, "request-feedback"),
    actions: area(section, "request-actions"),
    confirm: area(section, "request-confirm"),
    confirmText: area(section, "confirm-text"),
    confirmYes: areaButton(section, "confirm-yes"),
    confirmNo: areaButton(section, "confirm-no"),
  };
}

export async function fetchDetail(
  id: string,
): Promise<{ status: number; detail?: PanelRequestDetail }> {
  const response = await panelRead(`/api/panel/requests/${encodeURIComponent(id)}`);
  const detail = parse(panelRequestDetailSchema, response.data);
  if (detail === undefined) {
    return { status: response.ok ? UNEXPECTED_STATUS : response.status };
  }
  return { status: 200, detail };
}

export function clearDetail(view: DetailView): void {
  const { title, id, pii, facts, actions, confirm } = view;
  title.textContent = "Szczegóły wniosku";
  id.textContent = "";
  pii.hidden = true;
  pii.textContent = "";
  facts.replaceChildren();
  actions.replaceChildren();
  confirm.hidden = true;
}

export function renderFacts(view: DetailView, detail: PanelRequestDetail): void {
  const { facts, pii } = view;
  facts.replaceChildren(
    ...requestFacts(detail).flatMap((fact) => [
      el("dt", { text: fact.label }),
      el("dd", { text: fact.value }),
    ]),
  );
  const notice = piiNotice(detail);
  pii.hidden = notice === null;
  pii.textContent = notice ?? "";
}
