import type { BlockKind } from "../../lib/panel/blocks.ts";

interface OptionSpec {
  readonly value: string;
  readonly label: string;
}

interface FieldSpec {
  readonly name: string;
  readonly label: string;
  readonly tag: "input" | "textarea" | "select";
  readonly options?: readonly OptionSpec[];
  readonly max?: number;
}

const LEVELS: readonly OptionSpec[] = [
  { value: "2", label: "Poziom 2" },
  { value: "3", label: "Poziom 3" },
];

const ORDERS: readonly OptionSpec[] = [
  { value: "false", label: "punktowana" },
  { value: "true", label: "numerowana" },
];

export const FIELDS: Readonly<Record<BlockKind, readonly FieldSpec[]>> = {
  paragraph: [{ name: "text", label: "Treść", tag: "textarea", max: 5000 }],
  heading: [
    { name: "level", label: "Poziom", tag: "select", options: LEVELS },
    { name: "text", label: "Nagłówek", tag: "input", max: 200 },
  ],
  list: [
    { name: "ordered", label: "Rodzaj", tag: "select", options: ORDERS },
    { name: "items", label: "Pozycje (jedna w wierszu)", tag: "textarea", max: 5000 },
  ],
  quote: [
    { name: "text", label: "Wypowiedź", tag: "textarea", max: 5000 },
    { name: "source", label: "Źródło", tag: "input", max: 200 },
  ],
  table: [
    { name: "caption", label: "Podpis tabeli", tag: "input", max: 200 },
    { name: "header", label: "Nagłówki (oddziel znakiem „ | ”)", tag: "textarea", max: 5000 },
    { name: "rows", label: "Wiersze (komórki oddziel znakiem „ | ”)", tag: "textarea", max: 5000 },
  ],
  video: [
    { name: "id", label: "Identyfikator filmu z YouTube", tag: "input", max: 16 },
    { name: "title", label: "Tytuł filmu", tag: "input", max: 200 },
  ],
};

function controlField(spec: FieldSpec, value: string): HTMLTextAreaElement {
  const node = document.createElement("textarea");
  node.value = value;
  node.dataset["field"] = spec.name;
  if (spec.max !== undefined) {
    node.maxLength = spec.max;
  }
  return node;
}

function controlInput(spec: FieldSpec, value: string): HTMLInputElement {
  const node = document.createElement("input");
  node.type = "text";
  node.value = value;
  node.dataset["field"] = spec.name;
  if (spec.max !== undefined) {
    node.maxLength = spec.max;
  }
  return node;
}

function controlSelect(spec: FieldSpec, value: string): HTMLSelectElement {
  const node = document.createElement("select");
  node.dataset["field"] = spec.name;
  for (const option of spec.options ?? []) {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    node.append(item);
  }
  node.value = value;
  return node;
}

export function controlOf(
  spec: FieldSpec,
  value: string,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (spec.tag === "textarea") {
    return controlField(spec, value);
  }
  if (spec.tag === "select") {
    return controlSelect(spec, value);
  }
  return controlInput(spec, value);
}

export function fieldValueOf(row: HTMLElement, name: string): string {
  return (
    row.querySelector<HTMLTextAreaElement>(`:scope [data-field="${name}"]`)?.value ??
    row.querySelector<HTMLInputElement>(`:scope [data-field="${name}"]`)?.value ??
    row.querySelector<HTMLSelectElement>(`:scope [data-field="${name}"]`)?.value ??
    ""
  );
}
