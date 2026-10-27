import { datasetKeySchema, type DatasetKey } from "@zsm3/contracts/datasets";
import { z } from "zod";

import { firstRow, timestamp, type SqlStatement, type Store } from "./database.ts";

export interface StoredDataset {
  readonly key: DatasetKey;
  readonly data: unknown;
  readonly updatedAt: string;
}

export interface DatasetsRepo {
  get(key: DatasetKey): Promise<StoredDataset | undefined>;
  saveStatement(key: DatasetKey, data: unknown): SqlStatement;
}

const SELECT = "SELECT key, data_json, updated_at FROM datasets WHERE key = ?";

const UPSERT = `INSERT INTO datasets (key, data_json, updated_at) VALUES (?, ?, ?)
  ON CONFLICT (key) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`;

const rowSchema = z.object({
  key: datasetKeySchema,
  data_json: z.string(),
  updated_at: z.string(),
});

export function datasetsRepo({ db, clock }: Store): DatasetsRepo {
  return {
    get: async (key) => {
      const row = await firstRow(db.prepare(SELECT).bind(key), rowSchema);
      return row === undefined
        ? undefined
        : { key: row.key, data: JSON.parse(row.data_json), updatedAt: row.updated_at };
    },
    saveStatement: (key, data) =>
      db.prepare(UPSERT).bind(key, JSON.stringify(data), timestamp(clock)),
  };
}
