import type { DatasetKey } from "@zsm3/contracts/datasets";

import type { FieldSpec, RootSpec } from "./forms.ts";

export interface DatasetForm {
  readonly key: DatasetKey;
  readonly title: string;
  readonly intro: string;
  readonly page: string;
  readonly root: RootSpec;
}

export const text = (name: string, label: string, max: number): FieldSpec => ({
  kind: "text",
  name,
  label,
  max,
});
export const optional = (name: string, label: string, max: number): FieldSpec => ({
  kind: "text",
  name,
  label,
  max,
  optional: true,
});
export const id = (label: string): FieldSpec => ({
  kind: "text",
  name: "id",
  label,
  max: 60,
  hint: "małe litery, cyfry i myślniki; to kotwica w adresie strony",
});

export const contactCard: readonly FieldSpec[] = [
  text("title", "Nazwa", 120),
  text("role", "Czym się zajmuje", 200),
  {
    kind: "list",
    name: "phones",
    label: "Telefony",
    itemLabel: "Telefon",
    fields: [
      {
        kind: "text",
        name: "number",
        label: "Numer do wybierania",
        max: 30,
        hint: "np. +48126440689,104",
      },
      text("label", "Numer do wyświetlenia", 60),
    ],
  },
  { kind: "lines", name: "emails", label: "Adresy e-mail", hint: "jeden adres w wierszu" },
];
