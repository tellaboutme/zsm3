import { z } from "zod";

import { firstRow, type Store } from "../storage/database.ts";

const SELECT_CRON_STATE = "SELECT last_run_date FROM cron_state WHERE job = ?";
const UPSERT_CRON_STATE = `INSERT INTO cron_state (job, last_run_date) VALUES (?1, ?2)
  ON CONFLICT (job) DO UPDATE SET last_run_date = excluded.last_run_date`;

export interface CronStateRepo {
  lastRunDate(job: string): Promise<string | undefined>;
  markRunDate(job: string, date: string): Promise<void>;
}

export function cronStateRepo(store: Store): CronStateRepo {
  const { db } = store;
  return {
    lastRunDate: async (job) => {
      const row = await firstRow(
        db.prepare(SELECT_CRON_STATE).bind(job),
        z.strictObject({ last_run_date: z.string() }),
      );
      return row?.last_run_date;
    },
    markRunDate: async (job, date) => {
      await db.prepare(UPSERT_CRON_STATE).bind(job, date).run();
    },
  };
}

export function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}
