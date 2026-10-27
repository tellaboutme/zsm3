import {
  announcementInputSchema,
  announcementSchema,
  MAX_ANNOUNCEMENTS,
  type AnnouncementInput,
  type StoredAnnouncement,
} from "@zsm3/contracts/announcements";
import { z } from "zod";

import { allRows, firstRow, timestamp, type SqlStatement, type Store } from "./database.ts";
import { uuidv7 } from "./ids.ts";

export interface AnnouncementWrite {
  readonly id: string;
  readonly statement: SqlStatement;
}

export interface AnnouncementsRepo {
  list(): Promise<readonly StoredAnnouncement[]>;
  get(id: string): Promise<StoredAnnouncement | undefined>;
  active(day: string): Promise<StoredAnnouncement | undefined>;
  createStatement(item: AnnouncementInput): AnnouncementWrite;
  updateStatement(id: string, item: AnnouncementInput): SqlStatement;
  deleteStatement(id: string): SqlStatement;
}

const SELECT_ALL = `SELECT id, severity, text, link_label, link_href, starts_on, ends_on, updated_at
  FROM announcements ORDER BY starts_on DESC, id DESC LIMIT ?`;

const SELECT_ONE = `SELECT id, severity, text, link_label, link_href, starts_on, ends_on, updated_at
  FROM announcements WHERE id = ?`;

const SELECT_ACTIVE = `SELECT id, severity, text, link_label, link_href, starts_on, ends_on,
  updated_at FROM announcements WHERE ends_on >= ?1 AND starts_on <= ?1
  ORDER BY CASE severity WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
    starts_on DESC, id DESC
  LIMIT 1`;

const INSERT = `INSERT INTO announcements
  (id, severity, text, link_label, link_href, starts_on, ends_on, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const UPDATE = `UPDATE announcements SET severity = ?, text = ?, link_label = ?, link_href = ?,
  starts_on = ?, ends_on = ?, updated_at = ? WHERE id = ?`;

const DELETE = "DELETE FROM announcements WHERE id = ?";

const announcementRowSchema = z.object({
  id: z.string(),
  severity: z.string(),
  text: z.string(),
  link_label: z.string().nullable(),
  link_href: z.string().nullable(),
  starts_on: z.string(),
  ends_on: z.string(),
  updated_at: z.string(),
});

type AnnouncementRow = z.infer<typeof announcementRowSchema>;

export function announcementFromRow(row: AnnouncementRow): StoredAnnouncement {
  return announcementSchema.parse({
    id: row.id,
    updatedAt: row.updated_at,
    severity: row.severity,
    text: row.text,
    ...(row.link_href === null ? {} : { link: { label: row.link_label, href: row.link_href } }),
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  });
}

function columns(item: AnnouncementInput): readonly (string | null)[] {
  const parsed = announcementInputSchema.parse(item);
  return [
    parsed.severity,
    parsed.text,
    parsed.link?.label ?? null,
    parsed.link?.href ?? null,
    parsed.startsOn,
    parsed.endsOn,
  ];
}

export function announcementsRepo(store: Store): AnnouncementsRepo {
  const { db, clock, random } = store;
  const one = async (query: string, value: string): Promise<StoredAnnouncement | undefined> => {
    const row = await firstRow(db.prepare(query).bind(value), announcementRowSchema);
    return row === undefined ? undefined : announcementFromRow(row);
  };
  return {
    list: async () =>
      (await allRows(db.prepare(SELECT_ALL).bind(MAX_ANNOUNCEMENTS), announcementRowSchema)).map(
        announcementFromRow,
      ),
    get: async (id) => one(SELECT_ONE, id),
    active: async (day) => one(SELECT_ACTIVE, day),
    createStatement: (item) => {
      const id = uuidv7(clock().getTime(), random);
      const now = timestamp(clock);
      return { id, statement: db.prepare(INSERT).bind(id, ...columns(item), now, now) };
    },
    updateStatement: (id, item) => db.prepare(UPDATE).bind(...columns(item), timestamp(clock), id),
    deleteStatement: (id) => db.prepare(DELETE).bind(id),
  };
}
