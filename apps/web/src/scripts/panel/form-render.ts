import type { StoredFile } from "@zsm3/contracts/media";

import { button, el } from "./dom.ts";
import { optionNode } from "./event-row.ts";
import { bagOf, textOf } from "./form-dom.ts";
import {
  emptyValue,
  type FieldSpec,
  type FileField,
  type ListField,
  type ObjectField,
  type SelectField,
} from "../../lib/panel/forms.ts";

type ScalarField = Exclude<FieldSpec, ObjectField | ListField>;

export interface EngineContext {
  readonly files: readonly StoredFile[];
}

function labelled(field: FieldSpec, control: HTMLElement, hint?: string): HTMLElement {
  control.setAttribute("data-input", "");
  const children: HTMLElement[] = [control];
  if (hint !== undefined) {
    children.push(el("small", { className: "panel-meta", text: hint }));
  }
  return el("div", {
    className: "panel-field",
    attributes: { "data-field": field.name, "data-kind": field.kind },
    children: [el("label", { text: field.label, children })],
  });
}

function textControl(multiline: boolean, max: number, value: string): HTMLElement {
  const node = el(multiline ? "textarea" : "input", { attributes: { maxlength: String(max) } });
  if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) {
    node.value = value;
  }
  return node;
}

function fileKey(value: unknown): string {
  const href = textOf(bagOf(value)["href"]);
  return href.startsWith("/media/") ? href.slice("/media/".length) : "";
}

function fileControl(field: FileField, value: unknown, context: EngineContext): HTMLElement {
  const select = document.createElement("select");
  const current = fileKey(value);
  if (field.optional === true || current === "") {
    select.append(optionNode("", "— bez pliku —", false));
  }
  for (const file of context.files) {
    const option = optionNode(file.key, `${file.name} (${file.format})`, file.key === current);
    option.dataset["bytes"] = String(file.bytes);
    select.append(option);
  }
  select.value = current;
  return select;
}

function choiceControl(field: SelectField, value: unknown): HTMLElement {
  const select = document.createElement("select");
  if (field.optional === true) {
    select.append(optionNode("", "— brak —", false));
  }
  for (const option of field.options) {
    select.append(optionNode(option.value, option.label, option.value === value));
  }
  select.value = textOf(value);
  return select;
}

function checkControl(value: unknown): HTMLElement {
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = value === true;
  return box;
}

function dateControl(kind: "date" | "time", value: unknown): HTMLElement {
  const input = document.createElement("input");
  input.type = kind;
  input.value = textOf(value);
  return input;
}

function scalar(field: ScalarField, value: unknown, context: EngineContext): HTMLElement {
  if (field.kind === "text") {
    const control = textControl(field.multiline === true, field.max, textOf(value));
    return labelled(field, control, field.hint);
  }
  if (field.kind === "lines") {
    const lines = Array.isArray(value) ? value.map(textOf).join("\n") : "";
    return labelled(field, textControl(true, 4000, lines), field.hint);
  }
  if (field.kind === "select") {
    return labelled(field, choiceControl(field, value));
  }
  if (field.kind === "file") {
    return labelled(field, fileControl(field, value, context));
  }
  if (field.kind === "checkbox") {
    return labelled(field, checkControl(value));
  }
  if (field.kind === "number") {
    const input = el("input", {
      attributes: { type: "number", min: String(field.min), max: String(field.max) },
    });
    if (input instanceof HTMLInputElement) {
      input.value = textOf(value);
    }
    return labelled(field, input);
  }
  return labelled(field, dateControl(field.kind, value));
}

function itemNode(field: ListField, value: unknown, context: EngineContext): HTMLElement {
  const item = el("li", { className: "panel-item", attributes: { "data-item": "" } });
  for (const child of field.fields) {
    item.append(renderChild(child, value, context));
  }
  const up = button("W górę");
  const down = button("W dół");
  const remove = button(`Usuń: ${field.itemLabel.toLowerCase()}`);
  up.addEventListener("click", () => {
    item.previousElementSibling?.before(item);
  });
  down.addEventListener("click", () => {
    item.nextElementSibling?.after(item);
  });
  remove.addEventListener("click", () => {
    item.remove();
  });
  item.append(el("div", { className: "panel-actions", children: [up, down, remove] }));
  return item;
}

function renderChild(field: FieldSpec, parent: unknown, context: EngineContext): HTMLElement {
  const bag = bagOf(parent);
  if (field.kind === "file" && field.inline === true) {
    return renderField(field, { href: bag["href"], bytes: bag["bytes"] }, context);
  }
  return renderField(field, bag[field.name], context);
}

function renderGroup(
  field: ObjectField | ListField,
  value: unknown,
  context: EngineContext,
): HTMLElement {
  const box = el("fieldset", {
    className: "panel-group",
    attributes: { "data-field": field.name, "data-kind": field.kind },
    children: [el("legend", { text: field.label })],
  });
  if (field.kind === "object") {
    for (const child of field.fields) {
      box.append(renderChild(child, value, context));
    }
    return box;
  }
  const items = el("ol", { className: "panel-items", attributes: { "data-items": "" } });
  for (const entry of Array.isArray(value) ? value : []) {
    items.append(itemNode(field, entry, context));
  }
  const add = button(`Dodaj: ${field.itemLabel.toLowerCase()}`);
  add.addEventListener("click", () => {
    items.append(itemNode(field, emptyValue({ ...field, kind: "object" }), context));
  });
  box.append(items, add);
  return box;
}

export function renderField(field: FieldSpec, value: unknown, context: EngineContext): HTMLElement {
  if (field.kind === "object" || field.kind === "list") {
    return renderGroup(field, value, context);
  }
  return scalar(field, value, context);
}
