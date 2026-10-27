import { bagOf, directChildren, fieldNode, inputOf, type Bag } from "./form-dom.ts";
import { isBlank, linesOf, textOrAbsent, type FieldSpec } from "../../lib/panel/forms.ts";

function readFile(wrapper: HTMLElement): unknown {
  const select = inputOf(wrapper);
  if (!(select instanceof HTMLSelectElement) || select.value === "") {
    return undefined;
  }
  const bytes = Number(select.selectedOptions[0]?.dataset["bytes"] ?? "0");
  return { href: `/media/${select.value}`, bytes };
}

function readChecked(wrapper: HTMLElement): boolean {
  const box = inputOf(wrapper);
  return box instanceof HTMLInputElement && box.checked;
}

function readChoice(field: FieldSpec, wrapper: HTMLElement, raw: string): unknown {
  if (field.kind === "file") {
    return readFile(wrapper);
  }
  if (field.kind === "checkbox") {
    const checked = readChecked(wrapper);
    return checked || field.omitFalse !== true ? checked : undefined;
  }
  return field.kind === "select" && field.optional === true && raw === "" ? undefined : raw;
}

function readScalar(field: FieldSpec, wrapper: HTMLElement): unknown {
  const raw = inputOf(wrapper)?.value ?? "";
  if (field.kind === "number") {
    return raw.trim() === "" ? undefined : Number(raw);
  }
  if (field.kind === "lines") {
    return linesOf(raw);
  }
  if (field.kind === "text") {
    return field.optional === true ? textOrAbsent(raw) : raw.trim();
  }
  return readChoice(field, wrapper, raw);
}

function readChildren(fields: readonly FieldSpec[], container: Element): Bag {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const wrapper = fieldNode(container, field.name);
    const value = wrapper === undefined ? undefined : readField(field, wrapper);
    if (field.kind === "file" && field.inline === true) {
      Object.assign(result, bagOf(value));
    } else if (value !== undefined) {
      result[field.name] = value;
    }
  }
  return result;
}

export function readField(field: FieldSpec, wrapper: HTMLElement): unknown {
  if (field.kind === "object") {
    const value = readChildren(field.fields, wrapper);
    return field.optional === true && isBlank(value) ? undefined : value;
  }
  if (field.kind === "list") {
    const items = directChildren(wrapper, "[data-items]")[0];
    return items === undefined
      ? []
      : directChildren(items, "[data-item]").map((item) => readChildren(field.fields, item));
  }
  return readScalar(field, wrapper);
}
