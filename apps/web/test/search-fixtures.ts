import { datasetKeySchema } from "@zsm3/contracts/datasets";
import { seedSchoolYear } from "@zsm3/worker/seed/calendar/index.ts";
import { seedDatasets } from "@zsm3/worker/seed/datasets/index.ts";

import { baseSearchEntries } from "../src/data/search-index.ts";
import { datasetEntries, eventEntry } from "../src/lib/search-sources.ts";

export const staticSearchEntries = [
  ...baseSearchEntries(seedDatasets.kierunki),
  ...seedSchoolYear.map(eventEntry),
  ...datasetEntries({
    staff: seedDatasets.kadra,
    meetings: seedDatasets.wywiadowki,
    contacts: seedDatasets.kontakty,
    documents: seedDatasets.dokumenty,
  }),
];

export function datasetRow(query: string, values: readonly unknown[]): unknown {
  const key = datasetKeySchema.safeParse(values[0]);
  if (!query.includes("FROM datasets") || !key.success || key.data === "nawigacja") {
    return null;
  }
  return { key: key.data, data_json: JSON.stringify(seedDatasets[key.data]), updated_at: "x" };
}
