export interface Choice {
  readonly value: string;
  readonly label: string;
}

interface BaseField {
  readonly name: string;
  readonly label: string;
}

export interface TextField extends BaseField {
  readonly kind: "text";
  readonly max: number;
  readonly optional?: true;
  readonly multiline?: true;
  readonly hint?: string;
}

export interface DateField extends BaseField {
  readonly kind: "date" | "time";
}

export interface SelectField extends BaseField {
  readonly kind: "select";
  readonly options: readonly Choice[];
  readonly optional?: true;
}

export interface CheckboxField extends BaseField {
  readonly kind: "checkbox";
  readonly omitFalse?: true;
}

export interface NumberField extends BaseField {
  readonly kind: "number";
  readonly min: number;
  readonly max: number;
}

export interface LinesField extends BaseField {
  readonly kind: "lines";
  readonly hint?: string;
}

export interface FileField extends BaseField {
  readonly kind: "file";
  readonly optional?: true;
  readonly inline?: true;
}

export interface ObjectField extends BaseField {
  readonly kind: "object";
  readonly fields: readonly FieldSpec[];
  readonly optional?: true;
}

export interface ListField extends BaseField {
  readonly kind: "list";
  readonly itemLabel: string;
  readonly fields: readonly FieldSpec[];
}

export type FieldSpec =
  | TextField
  | DateField
  | SelectField
  | CheckboxField
  | NumberField
  | LinesField
  | FileField
  | ObjectField
  | ListField;

export type RootSpec = ObjectField | ListField;

export function linesOf(text: string): readonly string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function textOrAbsent(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

type ScalarKind = Exclude<FieldSpec["kind"], "object" | "list" | "select">;

const EMPTY_SCALARS: Readonly<Record<ScalarKind, unknown>> = {
  checkbox: false,
  number: "",
  text: "",
  date: "",
  time: "",
  lines: [],
  file: undefined,
};

export function emptyValue(field: FieldSpec): unknown {
  if (field.kind === "object" && field.optional === true) {
    return undefined;
  }
  if (field.kind === "object") {
    return Object.fromEntries(field.fields.map((child) => [child.name, emptyValue(child)]));
  }
  if (field.kind === "list") {
    return [];
  }
  if (field.kind === "select") {
    return field.optional === true ? undefined : (field.options[0]?.value ?? "");
  }
  return EMPTY_SCALARS[field.kind];
}

function childLabel(fields: readonly FieldSpec[], name: PropertyKey): FieldSpec | undefined {
  return fields.find((field) => field.name === name);
}

export function issueLocation(root: RootSpec, path: readonly PropertyKey[]): string {
  const labels: string[] = [];
  let current: FieldSpec | undefined = root;
  for (const step of path) {
    if (current?.kind === "list" && typeof step === "number") {
      labels.push(`${current.itemLabel} ${String(step + 1)}`);
      current = {
        kind: "object",
        name: current.name,
        label: current.itemLabel,
        fields: current.fields,
      };
      continue;
    }
    const next: FieldSpec | undefined =
      current?.kind === "object" ? childLabel(current.fields, step) : undefined;
    if (next !== undefined) {
      labels.push(next.label);
    }
    current = next;
  }
  return labels.join(" › ");
}

const ISSUE_PHRASES: Readonly<Record<string, string>> = {
  too_small: "pole jest puste albo za krótkie",
  too_big: "za dużo znaków albo elementów",
  invalid_format: "nieprawidłowy format",
  invalid_type: "brak wartości",
  invalid_value: "wartość spoza listy",
  custom: "wartości się wykluczają",
};

export function issuePhrase(
  root: RootSpec,
  issue: { readonly code: string; readonly path: readonly PropertyKey[] },
): string {
  const where = issueLocation(root, issue.path);
  const what = ISSUE_PHRASES[issue.code] ?? "nieprawidłowa wartość";
  return where === "" ? `Popraw dane: ${what}.` : `${where}: ${what}.`;
}

export function isBlank(value: Readonly<Record<string, unknown>>): boolean {
  return Object.values(value).every((entry) => entry === undefined || entry === "");
}
