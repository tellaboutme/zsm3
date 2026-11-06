import { describe, it } from "vitest";
import { z } from "zod";

import { ADMIN, as, auditRows, LEFT, setup, TEACHER } from "./panel-short-link-admin-support.ts";
import { expectProblem, panelJsonCall } from "./panel-support.ts";
import { openLink } from "../../src/short-links/resolve.ts";
import { systemClock } from "../../src/storage/database.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";
import { shortLinksAdminRepo } from "../../src/storage/short-links-admin-repo.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

describe("administrator revocation", () => {
  it("revokes a departed teacher's link and audits the real administrator", async ({ expect }) => {
    const harness = await setup();
    const response = await panelJsonCall(harness, "DELETE", "/short-links/all/k7mq4ra", {
      token: await as(harness, ADMIN),
      body: {},
    });

    expect(response.status).toBe(204);
    await expect(
      openLink(
        { links: shortLinksRepo({ db: harness.env.DB, clock: systemClock, random: cryptoRandom }) },
        "k7mq4ra",
        new Date(),
      ),
    ).resolves.toEqual({ kind: "gone" });
    const rows = await auditRows(harness);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actor_email: ADMIN,
      action: "short_link.admin_revoke",
      entity: "short_link",
      entity_id: "k7mq4ra",
    });
    const details: unknown = JSON.parse(
      z.object({ details_json: z.string() }).parse(rows[0]).details_json,
    );
    expect(details).toMatchObject({ owner: LEFT });
  });

  it("revokes once under concurrent requests and refuses links that are not active", async ({
    expect,
  }) => {
    const harness = await setup();
    const token = await as(harness, ADMIN);
    const call = async (code: string): Promise<Response> =>
      panelJsonCall(harness, "DELETE", `/short-links/all/${code}`, { token, body: {} });

    const statuses = (await Promise.all([call("k7mq4rb"), call("k7mq4rb")])).map((r) => r.status);
    expect(statuses.toSorted((left, right) => left - right)).toEqual([204, 404]);
    await expectProblem(await call("k7mq4rc"), 404);
    await expectProblem(await call("k7mq4rd"), 404);
    await expectProblem(await call("k7mq4zz"), 404);
    await expectProblem(await call("ZLY"), 422);
    expect(await auditRows(harness)).toHaveLength(1);
  });

  it("leaves ordinary revocation limited to the author", async ({ expect }) => {
    const harness = await setup();
    const teacher = await as(harness, TEACHER);

    await expectProblem(
      await panelJsonCall(harness, "DELETE", "/short-links/k7mq4ra", { token: teacher, body: {} }),
      404,
    );
    const response = await panelJsonCall(harness, "DELETE", "/short-links/k7mq4rb", {
      token: teacher,
      body: {},
    });
    expect(response.status).toBe(204);
    expect(await auditRows(harness)).toHaveLength(0);
  });
});

describe("administrator revocation batch", () => {
  it("names the batch when D1 reports uneven changes", async ({ expect }) => {
    const harness = await setup();
    const repo = shortLinksAdminRepo({
      db: {
        prepare: (query) => harness.env.DB.prepare(query),
        batch: async () => Promise.resolve([{ meta: { changes: 1 } }, { meta: { changes: 0 } }]),
      },
      clock: systemClock,
      random: cryptoRandom,
    });

    await expect(repo.revokeAny("k7mq4ra", ADMIN)).rejects.toThrow(
      "Inconsistent short link admin revoke batch",
    );
  });
});
