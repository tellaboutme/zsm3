import "../../lib/panel/zod-jitless.ts";
import type { BellSchedule } from "@zsm3/contracts/bells";

import { area, areaButton, areaForm, areaList, button, el, speak } from "./dom.ts";
import { optionNode } from "./event-row.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { panelRead, panelSend, problemPhrase } from "../../lib/panel/api.ts";
import {
  lessonsText,
  scheduleDraft,
  type DayDraft,
  type VariantDraft,
} from "../../lib/panel/bells.ts";
import { canEditContent } from "../../lib/panel/gate.ts";
import { PANEL_SCHEMAS, parse } from "../../lib/panel/models.ts";
import { bellsSave } from "../../lib/panel/mutations.ts";

interface Parts {
  readonly form: HTMLFormElement;
  readonly regular: HTMLTextAreaElement;
  readonly variants: HTMLUListElement;
  readonly days: HTMLUListElement;
  readonly status: HTMLElement;
  readonly saved: Set<string>;
}

function regularArea(form: HTMLFormElement): HTMLTextAreaElement {
  const node = form.querySelector('[name="regular"]');
  if (node instanceof HTMLTextAreaElement) {
    return node;
  }
  throw new Error('missing textarea [name="regular"]');
}

function partsFor(section: HTMLElement): Parts {
  const form = areaForm(section, "bells-form");
  return {
    form,
    regular: regularArea(form),
    variants: areaList(section, "variant-rows"),
    days: areaList(section, "day-rows"),
    status: area(section, "status"),
    saved: new Set(),
  };
}

function nextKey(parts: Parts): string {
  return `nowy-${String(parts.variants.children.length + 1)}-${String(Date.now())}`;
}

function field(label: string, control: HTMLElement): HTMLElement {
  return el("label", { text: label, children: [control] });
}

function variantRows(parts: Parts): readonly HTMLElement[] {
  return [...parts.variants.querySelectorAll<HTMLElement>("[data-variant-key]")];
}

function variantLabelOf(row: HTMLElement): string {
  return row.querySelector<HTMLInputElement>('[data-part="label"]')?.value ?? "";
}

function refreshDayOptions(parts: Parts): void {
  const choices = variantRows(parts).map((row) => {
    const label = variantLabelOf(row).trim();
    return { key: row.dataset["variantKey"] ?? "", label: label === "" ? "(bez nazwy)" : label };
  });
  for (const select of parts.days.querySelectorAll<HTMLSelectElement>('[data-part="variant"]')) {
    const current = select.value === "" ? (select.dataset["initial"] ?? "") : select.value;
    select.replaceChildren(
      ...choices.map((choice) => optionNode(choice.key, choice.label, choice.key === current)),
    );
  }
}

function variantRow(parts: Parts, key: string, label: string, text: string): HTMLElement {
  const name = el("input", {
    attributes: { "data-part": "label", maxlength: "120", value: label },
  });
  name.addEventListener("input", () => {
    refreshDayOptions(parts);
  });
  const lessons = el("textarea", { attributes: { "data-part": "lessons", rows: "8" } });
  lessons.textContent = text;
  const remove = button("Usuń wariant");
  const row = el("li", {
    className: "panel-item",
    attributes: { "data-variant-key": key },
    children: [field("Nazwa", name), field("Lekcje", lessons), remove],
  });
  remove.addEventListener("click", () => {
    row.remove();
    refreshDayOptions(parts);
    speak(parts.status, ["Usunięto wariant. Zapisz dzwonki."]);
  });
  return row;
}

function dayRow(date: string, key: string): HTMLElement {
  const day = el("input", { attributes: { "data-part": "date", type: "date", value: date } });
  const select = document.createElement("select");
  select.dataset["part"] = "variant";
  select.dataset["initial"] = key;
  const remove = button("Usuń dzień");
  const row = el("li", {
    className: "panel-row",
    children: [field("Dzień", day), field("Wariant", select), remove],
  });
  remove.addEventListener("click", () => {
    row.remove();
  });
  return row;
}

function readVariants(parts: Parts): readonly VariantDraft[] {
  return variantRows(parts).map((row) => ({
    key: row.dataset["variantKey"] ?? "",
    label: variantLabelOf(row),
    text: row.querySelector<HTMLTextAreaElement>('[data-part="lessons"]')?.value ?? "",
  }));
}

function readDays(parts: Parts): readonly DayDraft[] {
  return [...parts.days.children].map((row) => ({
    date: row.querySelector<HTMLInputElement>('[data-part="date"]')?.value ?? "",
    key: row.querySelector<HTMLSelectElement>('[data-part="variant"]')?.value ?? "",
  }));
}

function show(parts: Parts, schedule: BellSchedule): void {
  const { regular, saved } = parts;
  regular.value = lessonsText(schedule.regular);
  saved.clear();
  for (const variant of schedule.variants) {
    saved.add(variant.id);
  }
  parts.variants.replaceChildren(
    ...schedule.variants.map((variant) =>
      variantRow(parts, variant.id, variant.label, lessonsText(variant.lessons)),
    ),
  );
  parts.days.replaceChildren(...schedule.days.map((day) => dayRow(day.date, day.variant)));
  refreshDayOptions(parts);
}

async function load(parts: Parts): Promise<void> {
  const response = await panelRead("/api/panel/bells");
  const view = parse(PANEL_SCHEMAS.bells, response.data);
  if (view === undefined) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  show(parts, view.schedule);
}

async function save(parts: Parts): Promise<void> {
  const draft = scheduleDraft({
    regular: parts.regular.value,
    variants: readVariants(parts),
    days: readDays(parts),
    saved: parts.saved,
  });
  if (!draft.ok) {
    speak(parts.status, [draft.problem]);
    return;
  }
  const response = await panelSend("PUT", "/api/panel/bells", bellsSave(draft.value));
  if (!response.ok) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  show(parts, draft.value);
  speak(parts.status, ["Dzwonki zapisane."]);
}

export function wireDzwonki(section: HTMLElement): void {
  const parts = partsFor(section);
  parts.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void save(parts);
  });
  areaButton(section, "variant-add").addEventListener("click", () => {
    parts.variants.append(variantRow(parts, nextKey(parts), "", parts.regular.value));
    refreshDayOptions(parts);
  });
  areaButton(section, "day-add").addEventListener("click", () => {
    const first = variantRows(parts)[0]?.dataset["variantKey"] ?? "";
    parts.days.append(dayRow("", first));
    refreshDayOptions(parts);
  });
  const view = gateView(section);
  wireShell(view, (role) => {
    if (!canEditContent(role)) {
      denyContent(view);
      return;
    }
    void load(parts);
  });
}

const section = document.querySelector<HTMLElement>('[data-panel-page="bells"]');

if (section !== null) {
  wireDzwonki(section);
}
