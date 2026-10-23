import { storedFileSchema, type StoredFile } from "@zsm3/contracts/media";

import { firstRow, timestamp, type Store } from "./database.ts";

export interface FilesRepo {
  save(file: StoredFile): Promise<void>;
  find(key: string): Promise<StoredFile | undefined>;
}

const UPSERT = `INSERT INTO files (key, name, format, bytes, created_at) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (key) DO UPDATE SET name = excluded.name`;

const SELECT_ONE = "SELECT key, name, format, bytes FROM files WHERE key = ?";

export function filesRepo({ db, clock }: Store): FilesRepo {
  return {
    save: async (file) => {
      const parsed = storedFileSchema.parse(file);
      await db
        .prepare(UPSERT)
        .bind(parsed.key, parsed.name, parsed.format, parsed.bytes, timestamp(clock))
        .run();
    },
    find: async (key) => firstRow(db.prepare(SELECT_ONE).bind(key), storedFileSchema),
  };
}
