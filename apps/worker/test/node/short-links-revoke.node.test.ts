import { describe, it } from "vitest";
import { z } from "zod";

import { memoryDatabase, FIXED_CLOCK, counterRandom } from "./memory-database.ts";
import { staffMember } from "./panel-fixtures.ts";
import {
  expectProblem,
  panelHarness,
  panelJsonCall,
  panelRawCall,
  seedStaff,
  staffClaims,
  PANEL_ORIGIN,
} from "./panel-support.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

const OWNER = "owner@zsm3.test";
const OTHER = "other@zsm3.test";
const CODE = "k7mq4ra";

describe("panel short link revoke", () => {
  it("requires authentication, an active content role, origin and JSON", async ({ expect }) => {
    const harness = await panelHarness();
    await seedStaff(harness.env, [
      staffMember(OWNER, "editor", true),
      staffMember(OTHER, "gallery_editor", true),
      staffMember("inactive@zsm3.test", "admin", false),
    ]);
    const owner = await harness.keys.sign(staffClaims(OWNER));
    const gallery = await harness.keys.sign(staffClaims(OTHER));
    const inactive = await harness.keys.sign(staffClaims("inactive@zsm3.test"));
    await expectProblem(
      await panelRawCall(harness, "DELETE", `/short-links/${CODE}`, { headers: {} }),
      401,
    );
    await expectProblem(
      await panelJsonCall(harness, "DELETE", `/short-links/${CODE}`, { token: "forged", body: {} }),
      401,
    );
    await expectProblem(
      await panelJsonCall(harness, "DELETE", `/short-links/${CODE}`, { token: gallery, body: {} }),
      403,
    );
    await expectProblem(
      await panelJsonCall(harness, "DELETE", `/short-links/${CODE}`, { token: inactive, body: {} }),
      403,
    );
    for (const headers of [
      { authorization: `Bearer ${owner}`, "content-type": "application/json" },
      {
        authorization: `Bearer ${owner}`,
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      { authorization: `Bearer ${owner}`, origin: PANEL_ORIGIN, "content-type": "text/plain" },
    ]) {
      await expectProblem(
        await panelRawCall(harness, "DELETE", `/short-links/${CODE}`, { headers }),
        403,
      );
    }
    await expectProblem(
      await panelJsonCall(harness, "DELETE", "/short-links/INVALID", { token: owner, body: {} }),
      422,
    );
    await expectProblem(
      await panelJsonCall(harness, "DELETE", `/short-links/${CODE}`, { token: owner, body: {} }),
      404,
    );
    expect(
      await harness.env.DB.prepare("SELECT count(*) AS count FROM audit_log").first(),
    ).toMatchObject({ count: 0 });
  });

  it("returns 204 only once for the owner and records the same instant without secrets", async ({
    expect,
  }) => {
    const harness = await panelHarness();
    await seedStaff(harness.env, [
      staffMember(OWNER, "editor", true),
      staffMember(OTHER, "admin", true),
    ]);
    const links = shortLinksRepo({
      db: harness.env.DB,
      clock: FIXED_CLOCK,
      random: counterRandom(),
    });
    await links.create({
      code: CODE,
      target: "https://example.org",
      password: { salt: new Uint8Array(16), hash: new Uint8Array(32) },
      createdBy: OWNER,
      expiresAt: "2027-10-29T08:00:00.000Z",
    });
    const owner = await harness.keys.sign(staffClaims(OWNER));
    const other = await harness.keys.sign(staffClaims(OTHER));
    await expectProblem(
      await panelJsonCall(harness, "DELETE", `/short-links/${CODE}`, { token: other, body: {} }),
      404,
    );
    const success = await panelJsonCall(harness, "DELETE", `/short-links/${CODE}`, {
      token: owner,
      body: {},
    });
    expect(success.status).toBe(204);
    expect(await success.text()).toBe("");
    expect(success.headers.get("cache-control")).toBe("no-store");
    expect(success.headers.get("content-security-policy")).toContain("default-src 'none'");
    await expectProblem(
      await panelJsonCall(harness, "DELETE", `/short-links/${CODE}`, { token: owner, body: {} }),
      404,
    );
    const rows = await harness.env.DB.prepare("SELECT * FROM audit_log WHERE entity_id = ?1")
      .bind(CODE)
      .all();
    expect(rows.results).toHaveLength(1);
    const audit = z.object({ id: z.string(), at: z.string() }).parse(rows.results[0]);
    expect(rows.results[0]).toMatchObject({
      actor_email: OWNER,
      action: "short_link.revoke",
      entity: "short_link",
      entity_id: CODE,
    });
    expect(rows.results[0]).toHaveProperty(
      "details_json",
      JSON.stringify({ revoked_at: audit.at }),
    );
    expect(audit).toHaveProperty(
      "id",
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
      ),
    );
    expect(await links.find(CODE)).toMatchObject({ revokedAt: audit.at });
    expect(JSON.stringify(rows.results[0])).not.toMatch(
      /password|salt|hash|https:\/\/example.org/u,
    );
  });

  it("rolls back failed updates and rejects inconsistent batch counts", async ({ expect }) => {
    const db = memoryDatabase();
    const links = shortLinksRepo({ db, clock: FIXED_CLOCK, random: counterRandom() });
    await links.create({
      code: CODE,
      target: "https://example.org",
      password: null,
      createdBy: OWNER,
      expiresAt: "2027-10-29T08:00:00.000Z",
    });
    db.sqlite.exec(
      `CREATE TRIGGER fail_revoke BEFORE UPDATE ON short_links BEGIN SELECT RAISE(ABORT, 'failure'); END`,
    );
    await expect(links.revoke(CODE, OWNER)).rejects.toThrow();
    expect(db.sqlite.prepare("SELECT count(*) AS count FROM audit_log").get()).toMatchObject({
      count: 0,
    });
    db.sqlite.exec("DROP TRIGGER fail_revoke");
    db.sqlite.exec(
      `CREATE TRIGGER fail_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT, 'failure'); END`,
    );
    await expect(links.revoke(CODE, OWNER)).rejects.toThrow();
    expect(await links.find(CODE)).toMatchObject({ revokedAt: null });
    for (const counts of [[1, 0], [2, 2], [1], []]) {
      const inconsistent = shortLinksRepo({
        db: {
          prepare: (query) => db.prepare(query),
          batch: async () =>
            await Promise.resolve(counts.map((changes) => ({ meta: { changes } }))),
        },
        clock: FIXED_CLOCK,
        random: counterRandom(),
      });
      await expect(inconsistent.revoke(CODE, OWNER)).rejects.toThrow(
        "Inconsistent short link revoke batch",
      );
    }
  });
});
