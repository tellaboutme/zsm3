import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, it } from "vitest";

import { AUDIT_SHORT_LINK_REVOKE, REVOKE_SHORT_LINK } from "../src/storage/short-links-sql.ts";

const owner = "proof-owner@example.org";
const at = "2026-10-29T08:00:00.000Z";

async function revoke(code: string, actor: string, id: string) {
  return await env.DB.batch([
    env.DB.prepare(AUDIT_SHORT_LINK_REVOKE).bind(
      id,
      at,
      actor,
      JSON.stringify({ revoked_at: at }),
      code,
    ),
    env.DB.prepare(REVOKE_SHORT_LINK).bind(code, actor, at),
  ]);
}

async function audits(code: string) {
  return await env.DB.prepare("SELECT * FROM audit_log WHERE entity_id = ?1").bind(code).all();
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  for (const code of ["k7mq4ra", "k7mq4rb", "k7mq4rc", "k7mq4rd"]) {
    await env.DB.prepare(
      `INSERT INTO short_links
      (code, target_url, created_by, created_at, expires_at)
      VALUES (?1, 'https://example.org', ?2, '2026-10-22T08:00:00.000Z', '2027-10-22T08:00:00.000Z')`,
    )
      .bind(code, owner)
      .run();
  }
});

it("commits one owner transition and no repeated or foreign transition", async ({ expect }) => {
  expect(
    (await revoke("k7mq4ra", "foreign@example.org", "proof-foreign")).map((r) => r.meta.changes),
  ).toEqual([0, 0]);
  expect((await revoke("k7mq4ra", owner, "proof-first")).map((r) => r.meta.changes)).toEqual([
    1, 1,
  ]);
  expect((await revoke("k7mq4ra", owner, "proof-repeat")).map((r) => r.meta.changes)).toEqual([
    0, 0,
  ]);
  expect((await audits("k7mq4ra")).results).toHaveLength(1);
});

it("allows exactly one concurrent transition and audit", async ({ expect }) => {
  const results = await Promise.all([
    revoke("k7mq4rb", owner, "proof-concurrent-a"),
    revoke("k7mq4rb", owner, "proof-concurrent-b"),
  ]);
  expect(
    results
      .map((rows) => rows.map((r) => r.meta.changes))
      .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0)),
  ).toEqual([
    [0, 0],
    [1, 1],
  ]);
  expect((await audits("k7mq4rb")).results).toHaveLength(1);
});

it("rolls back the audit if the update fails", async ({ expect }) => {
  await env.DB.prepare(
    `CREATE TRIGGER proof_update_failure BEFORE UPDATE ON short_links
    WHEN OLD.code = 'k7mq4rc' BEGIN SELECT RAISE(ABORT, 'update failure'); END`,
  ).run();
  try {
    await expect(revoke("k7mq4rc", owner, "proof-update-failure")).rejects.toThrow();
    expect((await audits("k7mq4rc")).results).toHaveLength(0);
  } finally {
    await env.DB.prepare("DROP TRIGGER proof_update_failure").run();
  }
});

it("does not revoke if the audit insert fails", async ({ expect }) => {
  await env.DB.prepare(
    `CREATE TRIGGER proof_audit_failure BEFORE INSERT ON audit_log
    WHEN NEW.entity_id = 'k7mq4rd' BEGIN SELECT RAISE(ABORT, 'audit failure'); END`,
  ).run();
  try {
    await expect(revoke("k7mq4rd", owner, "proof-audit-failure")).rejects.toThrow();
    expect(
      (
        await env.DB.prepare("SELECT revoked_at FROM short_links WHERE code = ?1")
          .bind("k7mq4rd")
          .first()
      )?.["revoked_at"],
    ).toBeNull();
  } finally {
    await env.DB.prepare("DROP TRIGGER proof_audit_failure").run();
  }
});
