import { schoolEventSchema, type SchoolEvent } from "@zsm3/contracts/content";
import { z } from "zod";

import { allRows, timestamp, type SqlStatement, type Store } from "./database.ts";
import { uuidv7 } from "./ids.ts";

export interface EventsRepo {
  replaceYear(from: string, to: string, events: readonly SchoolEvent[]): Promise<void>;
  replaceStatements(
    from: string,
    to: string,
    events: readonly SchoolEvent[],
  ): readonly SqlStatement[];
  between(from: string, to: string): Promise<readonly SchoolEvent[]>;
}

const eventRowSchema = z.object({
  starts_on: z.string(),
  ends_on: z.string().nullable(),
  title: z.string(),
  audience: z.string(),
  kind: z.string(),
  note: z.string().nullable(),
  key_date: z.number(),
});

type EventRow = z.infer<typeof eventRowSchema>;

const DELETE_RANGE = "DELETE FROM events WHERE starts_on BETWEEN ? AND ?";

const INSERT = `INSERT INTO events
  (id, starts_on, ends_on, title, audience, kind, note, key_date, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const SELECT_RANGE = `SELECT starts_on, ends_on, title, audience, kind, note, key_date
  FROM events WHERE starts_on BETWEEN ? AND ? ORDER BY starts_on, title`;

export function eventFromRow(row: EventRow): SchoolEvent {
  return schoolEventSchema.parse({
    date: row.starts_on,
    title: row.title,
    audience: row.audience,
    kind: row.kind,
    ...(row.ends_on === null ? {} : { endDate: row.ends_on }),
    ...(row.note === null ? {} : { note: row.note }),
    ...(row.key_date === 1 ? { key: true } : {}),
  });
}

function replaceStatements(
  { db, clock, random }: Store,
  range: readonly [string, string],
  events: readonly SchoolEvent[],
): readonly SqlStatement[] {
  const now = timestamp(clock);
  const inserts = events.map((item) => {
    const event = schoolEventSchema.parse(item);
    return db
      .prepare(INSERT)
      .bind(
        uuidv7(clock().getTime(), random),
        event.date,
        event.endDate ?? null,
        event.title,
        event.audience,
        event.kind,
        event.note ?? null,
        event.key === true ? 1 : 0,
        now,
        now,
      );
  });
  return [db.prepare(DELETE_RANGE).bind(...range), ...inserts];
}

export function eventsRepo(store: Store): EventsRepo {
  return {
    replaceYear: async (from, to, events) => {
      await store.db.batch([...replaceStatements(store, [from, to], events)]);
    },
    replaceStatements: (from, to, events) => replaceStatements(store, [from, to], events),
    between: async (from, to) =>
      (await allRows(store.db.prepare(SELECT_RANGE).bind(from, to), eventRowSchema)).map(
        eventFromRow,
      ),
  };
}
