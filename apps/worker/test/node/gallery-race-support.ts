import type { PanelHarness } from "./panel-support.ts";
import { vp8Webp } from "./webp-fixtures.ts";
import type { SqlDatabase } from "../../src/storage/database.ts";

export function beforeBatch(harness: PanelHarness, before: () => Promise<void>): PanelHarness {
  const { DB } = harness.env;
  let armed = true;
  const db: SqlDatabase = {
    prepare: (query) => DB.prepare(query),
    batch: async (statements) => {
      if (armed) {
        armed = false;
        await before();
      }
      return DB.batch(statements);
    },
  };
  return { ...harness, env: { ...harness.env, DB: db } };
}

export async function largeHash(): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(vp8Webp(1600, 900, [1, 0])));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function fillAlbum(harness: PanelHarness, id: string, count: number): Promise<void> {
  await harness.env.DB.prepare(
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?2)
     INSERT INTO photos (id, album_id, position, width, height, alt, sha256, consent_by, consent_at, created_by, created_at)
     SELECT 'fake-' || i, ?1, i, 1600, 900, 'Opis', printf('%064x', i), 'x', 't', 'x', 't' FROM n`,
  )
    .bind(id, count)
    .run();
}
