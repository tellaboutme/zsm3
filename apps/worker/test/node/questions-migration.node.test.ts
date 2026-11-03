import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { describe, it } from "vitest";

const MIGRATIONS = new URL("../../migrations/", import.meta.url);
const QUESTIONS_MIGRATION = "0016_questions.sql";

function migrated(until: (file: string) => boolean): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  const files = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql") && until(file))
    .toSorted();
  for (const file of files) {
    db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  return db;
}

const INSERT_STAFF = `INSERT INTO staff (email, role, active, created_at, updated_at)
  VALUES (?, ?, ?, '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z')`;
const SELECT_STAFF = "SELECT email, role, active, created_at, updated_at FROM staff ORDER BY email";

describe("migration 0016", () => {
  it("keeps every existing account, role and state when it rebuilds staff", ({ expect }) => {
    const db = migrated((file) => file < QUESTIONS_MIGRATION);
    const accounts = [
      ["admin@zsm3.test", "admin", 1],
      ["editor@zsm3.test", "editor", 1],
      ["galeria@zsm3.test", "gallery_editor", 0],
      ["sekretariat@zsm3.test", "secretariat", 1],
    ] as const;
    for (const account of accounts) {
      db.prepare(INSERT_STAFF).run(...account);
    }
    const before = db.prepare(SELECT_STAFF).all();

    db.exec(readFileSync(new URL(QUESTIONS_MIGRATION, MIGRATIONS), "utf8"));
    db.prepare(INSERT_STAFF).run("pedagog@zsm3.test", "counsellor", 1);

    expect(
      db
        .prepare(SELECT_STAFF)
        .all()
        .filter((row) => row["role"] !== "counsellor"),
    ).toEqual(before);
    expect(() => db.prepare(INSERT_STAFF).run("x@zsm3.test", "moderator", 1)).toThrow(
      /CHECK constraint failed/u,
    );
    expect(db.prepare("PRAGMA foreign_key_list(staff)").all()).toEqual([]);
  });

  it("rejects question rows that break the publication rules", ({ expect }) => {
    const db = migrated(() => true);
    const broken = [
      "INSERT INTO questions (id, addressee, status, version, form_key, received_on) VALUES ('a', 'pedagogue', 'received', 1, 'k1', '2026-10-20')",
      "INSERT INTO questions (id, addressee, status, version, form_key, received_on, published_question, published_answer, published_on, draft_ciphertext, draft_key_id) VALUES ('b', 'pedagogue', 'published', 1, 'k2', '2026-10-20', 'P', 'O', '2026-10-21', x'00', 'PRIMARY')",
      "INSERT INTO questions (id, addressee, status, version, form_key, received_on, question_ciphertext, question_key_id) VALUES ('c', 'pedagogue', 'received', 1, 'k3', '2026-10-20T08:00', x'00', 'PRIMARY')",
      "INSERT INTO questions (id, addressee, status, version, form_key, received_on, question_ciphertext, question_key_id) VALUES ('d', 'teacher', 'received', 1, 'k4', '2026-10-20', x'00', 'PRIMARY')",
      "INSERT INTO questions (id, addressee, status, version, form_key, received_on, question_ciphertext, question_key_id) VALUES ('e', 'pedagogue', 'received', 0, 'k5', '2026-10-20', x'00', 'PRIMARY')",
    ];

    for (const statement of broken) {
      expect(() => {
        db.exec(statement);
      }, statement).toThrow(/CHECK constraint failed/u);
    }
    expect(db.prepare("SELECT count(*) AS total FROM questions").get()).toEqual({ total: 0 });
  });
});
