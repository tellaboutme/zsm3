import type { DatasetForm } from "./dataset-fields.ts";
import { NAVIGATION_FORMS } from "./dataset-forms-navigation.ts";
import { PEOPLE_FORMS } from "./dataset-forms-people.ts";
import { PROGRAMME_FORMS } from "./dataset-forms-programmes.ts";
import { SITE_FORMS } from "./dataset-forms-site.ts";

export type { DatasetForm } from "./dataset-fields.ts";

export const DATASET_FORMS: readonly DatasetForm[] = [
  ...PEOPLE_FORMS,
  ...SITE_FORMS,
  ...PROGRAMME_FORMS,
  ...NAVIGATION_FORMS,
];

export function datasetForm(key: string): DatasetForm | undefined {
  return DATASET_FORMS.find((form) => form.key === key);
}
