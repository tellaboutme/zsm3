import { panelStaffRoleSchema } from "@zsm3/contracts/panel";
import { z } from "zod";

import { firstRow, allRows, timestamp, type SqlStatement, type Store } from "./database.ts";

export type StaffRole = z.infer<typeof staffRoleSchema>;

export const staffRoleSchema = panelStaffRoleSchema;

export interface Staff {
  readonly email: string;
  readonly role: StaffRole;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const staffSchema = z.strictObject({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[^@\s]+@[^@\s]+$/),
  role: staffRoleSchema,
  active: z.boolean(),
});

export type StaffInput = z.infer<typeof staffSchema>;

export interface StaffRepo {
  get(email: string): Promise<Staff | undefined>;
  list(): Promise<readonly Staff[]>;
  save(staff: StaffInput): Promise<void>;
  saveStatement(staff: StaffInput): SqlStatement;
}

const UPSERT = `INSERT INTO staff (email, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (email) DO UPDATE SET role = excluded.role, active = excluded.active,
  updated_at = excluded.updated_at`;

const SELECT_ONE = "SELECT email, role, active, created_at, updated_at FROM staff WHERE email = ?";

const SELECT_ALL = "SELECT email, role, active, created_at, updated_at FROM staff ORDER BY email";

const staffRowSchema = staffSchema.extend({
  active: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

type StaffRow = z.infer<typeof staffRowSchema>;

export function staffFromRow(row: StaffRow): Staff {
  return {
    email: row.email,
    role: row.role,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function saveStatement({ db, clock }: Store, staff: StaffInput): SqlStatement {
  const parsed = staffSchema.parse(staff);
  const now = timestamp(clock);
  return db.prepare(UPSERT).bind(parsed.email, parsed.role, parsed.active ? 1 : 0, now, now);
}

export function staffRepo(store: Store): StaffRepo {
  const { db } = store;
  return {
    get: async (email) => {
      const row = await firstRow(
        db.prepare(SELECT_ONE).bind(normaliseEmail(email)),
        staffRowSchema,
      );
      return row === undefined ? undefined : staffFromRow(row);
    },
    list: async () => (await allRows(db.prepare(SELECT_ALL), staffRowSchema)).map(staffFromRow),
    save: async (staff) => {
      await saveStatement(store, staff).run();
    },
    saveStatement: (staff) => saveStatement(store, staff),
  };
}
