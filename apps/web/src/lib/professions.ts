import type { Profession } from "@zsm3/contracts/programmes";

export const fields = [
  "informatyka",
  "mechatronika",
  "motoryzacja",
  "lotnictwo",
  "logistyka",
] as const;

export type Field = Profession["field"];

export type FieldFilter = Field | "wszystkie";

export type { Profession } from "@zsm3/contracts/programmes";

export type School = Profession["paths"][number]["school"];

export type Qualification = Profession["qualifications"][number];

export type StudyPath = Profession["paths"][number];

export const fieldLabels: Readonly<Record<Field, string>> = {
  informatyka: "Informatyka",
  mechatronika: "Mechatronika i robotyka",
  motoryzacja: "Motoryzacja",
  lotnictwo: "Lotnictwo",
  logistyka: "Porty i terminale",
};

export const schoolLabels: Readonly<Record<School, string>> = {
  technikum: "Technikum",
  "branzowa-1": "Branżowa I stopnia",
  "branzowa-2": "Branżowa II stopnia",
};

export function isFieldFilter(value: string | undefined): value is FieldFilter {
  return value === "wszystkie" || fields.some((field) => field === value);
}

export function matchesField(field: string | undefined, filter: FieldFilter): boolean {
  return filter === "wszystkie" || field === filter;
}

export function fieldCounts(professions: readonly Profession[]): ReadonlyMap<Field, number> {
  return new Map(
    fields.map((field) => [field, professions.filter((item) => item.field === field).length]),
  );
}

export function pathLabel({ school, years }: StudyPath): string {
  return `${schoolLabels[school]} · ${String(years)} ${years < 5 ? "lata" : "lat"}`;
}
