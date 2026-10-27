import "../../lib/panel/zod-jitless.ts";
import type { SchoolEvent } from "@zsm3/contracts/content";
import { schoolYearLabel } from "@zsm3/contracts/panel";

import { area, areaButton, button, el, speak } from "./dom.ts";
import { audienceField, keyField, kindField, optionNode, userInput } from "./event-row.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { panelRead, panelSend, problemPhrase } from "../../lib/panel/api.ts";
import {
  eventsFrom,
  rowFor,
  schoolYearFor,
  yearChoices,
  type EventRow,
} from "../../lib/panel/events.ts";
import { canEditContent } from "../../lib/panel/gate.ts";
import { PANEL_SCHEMAS, parse } from "../../lib/panel/models.ts";
import { eventsSave } from "../../lib/panel/mutations.ts";

interface Parts {
  readonly yearSelect: HTMLSelectElement;
  readonly rows: HTMLElement;
  readonly status: HTMLElement;
  readonly save: HTMLButtonElement;
  readonly empty: HTMLButtonElement;
}

const EMPTY_ROW: EventRow = {
  date: "",
  endDate: "",
  title: "",
  audience: "Wszyscy",
  kind: "zebranie",
  note: "",
  key: false,
};

function partsFor(section: HTMLElement): Parts {
  const yearSelect = section.querySelector<HTMLSelectElement>(`[data-part="year"]`);
  if (yearSelect === null) {
    throw new Error(`missing year select`);
  }
  const empty = button("Zapisz pusty rok", "panel-save-empty");
  empty.hidden = true;
  return {
    yearSelect,
    rows: area(section, "event-rows"),
    status: area(section, "status"),
    save: areaButton(section, "event-save"),
    empty,
  };
}

function dumpButton(parts: Parts, node: HTMLElement, index: number): HTMLElement {
  const nodeButton = button("Usuń", "panel-remove-event");
  nodeButton.setAttribute("aria-label", `Usuń wydarzenie ${String(index + 1)}`);
  nodeButton.addEventListener("click", () => {
    node.remove();
    speak(parts.status, ["Wydarzenie usunięto. Zapisz rok szkolny."]);
  });
  return nodeButton;
}

function rowNode(parts: Parts, row: EventRow, index: number): HTMLElement {
  const node = document.createElement("fieldset");
  node.className = "panel-event";
  node.append(el("legend", { text: `Wydarzenie ${String(index + 1)}` }));
  node.append(
    userInput(row, "date", "Data", 10),
    userInput(row, "endDate", "Data końcowa", 10),
    userInput(row, "title", "Nazwa", 200),
    audienceField(row),
    kindField(row),
    keyField(row),
    userInput(row, "note", "Uwaga", 300),
    dumpButton(parts, node, index),
  );
  return node;
}

function partText(part: HTMLElement, name: string): string {
  return part.querySelector<HTMLInputElement>(`[data-part="${name}"]`)?.value ?? "";
}

function partChecked(part: HTMLElement, name: string): boolean {
  return part.querySelector<HTMLInputElement>(`[data-part="${name}"]`)?.checked === true;
}

function partSelectValue(part: HTMLElement, name: string): string {
  return part.querySelector<HTMLSelectElement>(`[data-part="${name}"]`)?.value ?? "";
}

function rowValues(node: HTMLElement): EventRow {
  return {
    date: partText(node, "date"),
    endDate: partText(node, "endDate"),
    title: partText(node, "title"),
    audience: partSelectValue(node, "audience"),
    kind: partSelectValue(node, "kind"),
    note: partText(node, "note"),
    key: partChecked(node, "key"),
  };
}

function readRows(parts: Parts): readonly EventRow[] {
  const rows: EventRow[] = [];
  for (const child of parts.rows.children) {
    if (child instanceof HTMLElement) {
      rows.push(rowValues(child));
    }
  }
  return rows;
}

function renderRows(parts: Parts, events: readonly SchoolEvent[]): void {
  const rows = events.map(rowFor);
  parts.rows.replaceChildren(...rows.map((row, index) => rowNode(parts, row, index)));
}

function fillYears(select: HTMLSelectElement, now: Date): void {
  const node = select;
  const current = schoolYearFor(now);
  for (const year of yearChoices(now)) {
    node.append(optionNode(String(year), schoolYearLabel(year), year === current));
  }
  node.value = String(current);
}

async function loadYear(parts: Parts, year: number): Promise<void> {
  speak(parts.status, ["Wczytywanie terminarza…"]);
  const empty = parts.empty;
  empty.hidden = true;
  const response = await panelRead(`/api/panel/events/${String(year)}`);
  const list = parse(PANEL_SCHEMAS.eventList, response.data);
  if (list === undefined) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  renderRows(parts, list.items);
  speak(parts.status, [`Wydarzenia w roku ${schoolYearLabel(year)}: ${String(list.items.length)}`]);
}

function savedPhrase(year: number, count: number): string {
  if (count === 0) {
    return `${schoolYearLabel(year)}: zapisano rok bez wydarzeń.`;
  }
  return `${schoolYearLabel(year)}: zapisano ${String(count)} wydarzeń.`;
}

async function sendYear(parts: Parts, events: readonly SchoolEvent[]): Promise<void> {
  const empty = parts.empty;
  empty.hidden = true;
  const year = Number(parts.yearSelect.value);
  const response = await panelSend("PUT", `/api/panel/events/${String(year)}`, eventsSave(events));
  if (!response.ok) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  speak(parts.status, [savedPhrase(year, events.length)]);
}

async function saveYear(parts: Parts): Promise<void> {
  const events = eventsFrom(readRows(parts));
  const empty = parts.empty;
  if (events.length === 0 && empty.hidden === true) {
    empty.hidden = false;
    empty.focus();
    speak(parts.status, [
      "Rok szkolny jest pusty. Kliknij „Zapisz pusty rok”, aby usunąć wszystkie wydarzenia.",
    ]);
    return;
  }
  await sendYear(parts, events);
}

export function wireTerminarz(section: HTMLElement): void {
  const parts = partsFor(section);
  const now = new Date();
  fillYears(parts.yearSelect, now);
  parts.save.after(parts.empty);
  parts.empty.addEventListener("click", () => {
    void sendYear(parts, eventsFrom(readRows(parts)));
  });
  parts.save.addEventListener("click", () => {
    void saveYear(parts);
  });
  parts.yearSelect.addEventListener("change", () => {
    void loadYear(parts, Number(parts.yearSelect.value));
  });
  areaButton(section, "event-add").addEventListener("click", () => {
    const empty = parts.empty;
    empty.hidden = true;
    parts.rows.append(rowNode(parts, EMPTY_ROW, parts.rows.children.length));
    speak(parts.status, ["Dodano wiersz. Zapisz rok szkolny."]);
  });
  void loadYear(parts, schoolYearFor(now));
}

const section = document.querySelector<HTMLElement>('[data-panel-page="events"]');

if (section !== null) {
  const view = gateView(section);
  wireShell(view, (role) => {
    if (!canEditContent(role)) {
      denyContent(view);
      return;
    }
    wireTerminarz(section);
  });
}
