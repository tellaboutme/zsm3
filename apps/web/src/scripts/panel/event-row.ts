import { el } from "./dom.ts";
import { AUDIENCES, KIND_KEYS, KIND_LABELS, type EventRow } from "../../lib/panel/events.ts";

export type RowText = "date" | "endDate" | "title" | "note";

export function optionNode(value: string, label: string, selected: boolean): HTMLOptionElement {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  node.selected = selected;
  return node;
}

function wrap(label: string, node: HTMLElement): HTMLElement {
  return el("label", { text: label, children: [node] });
}

export function userInput(row: EventRow, name: RowText, label: string, max: number): HTMLElement {
  return wrap(
    label,
    el("input", { attributes: { "data-part": name, maxlength: String(max), value: row[name] } }),
  );
}

export function audienceField(row: EventRow): HTMLElement {
  const select = document.createElement("select");
  select.dataset["part"] = "audience";
  for (const name of AUDIENCES) {
    select.append(optionNode(name, name, name === row.audience));
  }
  select.value = row.audience;
  return wrap("Odbiorcy", select);
}

export function kindField(row: EventRow): HTMLElement {
  const select = document.createElement("select");
  select.dataset["part"] = "kind";
  for (const kind of KIND_KEYS) {
    select.append(optionNode(kind, KIND_LABELS[kind] ?? kind, kind === row.kind));
  }
  select.value = row.kind;
  return wrap("Rodzaj", select);
}

export function keyField(row: EventRow): HTMLElement {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset["part"] = "key";
  input.checked = row.key;
  return wrap("Kluczowe wydarzenie", input);
}
