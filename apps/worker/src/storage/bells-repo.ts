import { bellScheduleSchema, type BellSchedule } from "@zsm3/contracts/bells";
import { z } from "zod";

import { firstRow, timestamp, type SqlStatement, type Store } from "./database.ts";

export interface BellsRepo {
  get(): Promise<BellSchedule | undefined>;
  saveStatement(schedule: BellSchedule): SqlStatement;
}

const SELECT = "SELECT data_json FROM bell_schedule WHERE id = 1";

const UPSERT = `INSERT INTO bell_schedule (id, data_json, updated_at) VALUES (1, ?, ?)
  ON CONFLICT (id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`;

export function bellsRepo({ db, clock }: Store): BellsRepo {
  return {
    get: async () => {
      const row = await firstRow(db.prepare(SELECT), z.object({ data_json: z.string() }));
      return row === undefined ? undefined : bellScheduleSchema.parse(JSON.parse(row.data_json));
    },
    saveStatement: (schedule) =>
      db.prepare(UPSERT).bind(JSON.stringify(bellScheduleSchema.parse(schedule)), timestamp(clock)),
  };
}
