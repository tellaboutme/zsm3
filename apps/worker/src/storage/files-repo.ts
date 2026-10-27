import { storedFileSchema, type StoredFile } from "@zsm3/contracts/media";

import { firstRow, timestamp, type SqlStatement, type Store } from "./database.ts";

export interface FilesRepo {
  save(file: StoredFile): Promise<void>;
  saveStatement(file: StoredFile): SqlStatement;
  find(key: string): Promise<StoredFile | undefined>;
}

const UPSERT = `INSERT INTO files (key, name, format, bytes, created_at) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (key) DO UPDATE SET name = excluded.name`;

const SELECT_ONE = "SELECT key, name, format, bytes FROM files WHERE key = ?";

function saveFile({ db, clock }: Store, file: StoredFile): SqlStatement {
  const parsed = storedFileSchema.parse(file);
  return db
    .prepare(UPSERT)
    .bind(parsed.key, parsed.name, parsed.format, parsed.bytes, timestamp(clock));
}

export function filesRepo(store: Store): FilesRepo {
  return {
    save: async (file) => {
      await store.db.batch([saveFile(store, file)]);
    },
    saveStatement: (file) => saveFile(store, file),
    find: async (key) => firstRow(store.db.prepare(SELECT_ONE).bind(key), storedFileSchema),
  };
}
