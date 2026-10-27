import "../../lib/panel/zod-jitless.ts";
import type { StoredAnnouncement } from "@zsm3/contracts/announcements";

import {
  area,
  areaButton,
  areaForm,
  areaList,
  button,
  el,
  inputValue,
  setInputValue,
  speak,
} from "./dom.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { isoDay } from "../../lib/calendar.ts";
import { announcementDraft, announcementSummary } from "../../lib/panel/announcements.ts";
import { panelDelete, panelRead, panelSend, problemPhrase } from "../../lib/panel/api.ts";
import { canEditContent } from "../../lib/panel/gate.ts";
import { PANEL_SCHEMAS, parse } from "../../lib/panel/models.ts";
import { announcementSave } from "../../lib/panel/mutations.ts";

interface Parts {
  readonly form: HTMLFormElement;
  readonly legend: HTMLElement;
  readonly cancel: HTMLButtonElement;
  readonly rows: HTMLUListElement;
  readonly status: HTMLElement;
}

const SEVERITY_NAMES = { info: "Informacja", important: "Ważne", urgent: "Pilne" } as const;

function partsFor(section: HTMLElement): Parts {
  const form = areaForm(section, "announcement-form");
  return {
    form,
    legend: area(form, "form-legend"),
    cancel: areaButton(form, "announcement-cancel"),
    rows: areaList(section, "announcement-rows"),
    status: area(section, "status"),
  };
}

function textArea(form: HTMLFormElement): HTMLTextAreaElement | undefined {
  return form.querySelector<HTMLTextAreaElement>('[name="text"]') ?? undefined;
}

function selectValue(form: HTMLFormElement): string {
  return form.querySelector<HTMLSelectElement>('[name="severity"]')?.value ?? "";
}

function editingId(parts: Parts): string | undefined {
  return parts.form.dataset["editing"];
}

function resetForm(parts: Parts): void {
  const { form, legend, cancel } = parts;
  form.reset();
  delete form.dataset["editing"];
  legend.textContent = "Nowe ogłoszenie";
  cancel.hidden = true;
}

function startEditing(parts: Parts, item: StoredAnnouncement): void {
  const { form, legend, cancel } = parts;
  form.dataset["editing"] = item.id;
  const severity = parts.form.querySelector<HTMLSelectElement>('[name="severity"]');
  if (severity !== null) {
    severity.value = item.severity;
  }
  const text = textArea(parts.form);
  if (text !== undefined) {
    text.value = item.text;
  }
  setInputValue(parts.form, "startsOn", item.startsOn);
  setInputValue(parts.form, "endsOn", item.endsOn);
  setInputValue(parts.form, "linkLabel", item.link?.label ?? "");
  setInputValue(parts.form, "linkHref", item.link?.href ?? "");
  legend.textContent = "Edycja ogłoszenia";
  cancel.hidden = false;
  textArea(parts.form)?.focus();
}

function rowNode(parts: Parts, item: StoredAnnouncement, today: string): HTMLElement {
  const edit = button("Edytuj");
  edit.setAttribute("aria-label", `Edytuj ogłoszenie: ${item.text}`);
  edit.addEventListener("click", () => {
    startEditing(parts, item);
  });
  const remove = button("Usuń");
  remove.setAttribute("aria-label", `Usuń ogłoszenie: ${item.text}`);
  remove.addEventListener("click", () => {
    void removeAnnouncement(parts, item.id);
  });
  return el("li", {
    className: "panel-item",
    children: [
      el("p", { className: "panel-meta", text: announcementSummary(item, today) }),
      el("p", { text: `${SEVERITY_NAMES[item.severity]}: ${item.text}` }),
      el("div", { className: "panel-actions", children: [edit, remove] }),
    ],
  });
}

async function refresh(parts: Parts): Promise<void> {
  const response = await panelRead("/api/panel/announcements");
  const list = parse(PANEL_SCHEMAS.announcementList, response.data);
  if (list === undefined) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  const today = isoDay(new Date());
  parts.rows.replaceChildren(...list.items.map((item) => rowNode(parts, item, today)));
  if (list.items.length === 0) {
    speak(parts.status, ["Brak ogłoszeń."]);
  }
}

async function submit(parts: Parts): Promise<void> {
  const draft = announcementDraft({
    severity: selectValue(parts.form),
    text: textArea(parts.form)?.value ?? "",
    linkLabel: inputValue(parts.form, "linkLabel"),
    linkHref: inputValue(parts.form, "linkHref"),
    startsOn: inputValue(parts.form, "startsOn"),
    endsOn: inputValue(parts.form, "endsOn"),
  });
  if (!draft.ok) {
    speak(parts.status, [draft.problem]);
    return;
  }
  const editing = editingId(parts);
  const response =
    editing === undefined
      ? await panelSend("POST", "/api/panel/announcements", announcementSave(draft.item))
      : await panelSend("PUT", `/api/panel/announcements/${editing}`, announcementSave(draft.item));
  if (!response.ok) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  resetForm(parts);
  await refresh(parts);
  speak(parts.status, ["Ogłoszenie zapisane. Strona pokaże je w wybranych dniach."]);
}

async function removeAnnouncement(parts: Parts, id: string): Promise<void> {
  const response = await panelDelete(`/api/panel/announcements/${id}`);
  if (!response.ok) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  if (editingId(parts) === id) {
    resetForm(parts);
  }
  await refresh(parts);
  speak(parts.status, ["Ogłoszenie usunięte."]);
}

export function wireOgloszenia(section: HTMLElement): void {
  const parts = partsFor(section);
  parts.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submit(parts);
  });
  parts.cancel.addEventListener("click", () => {
    resetForm(parts);
  });
  const view = gateView(section);
  wireShell(view, (role) => {
    if (!canEditContent(role)) {
      denyContent(view);
      return;
    }
    void refresh(parts);
  });
}

const section = document.querySelector<HTMLElement>('[data-panel-page="announcements"]');

if (section !== null) {
  wireOgloszenia(section);
}
