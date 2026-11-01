import { panelRequestsListSchema } from "@zsm3/contracts/panel-requests";
import { describe, expect, it } from "vitest";

import { SECRETARIAT, seedRequest } from "./panel-requests-support.ts";
import {
  expectProblem,
  panelHarness,
  panelJsonCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";

describe("panel requests list", () => {
  it("lists requests newest first with filters and a cursor, never with personal data", async () => {
    const harness = await panelHarness();
    await seedStaff(harness.env, [SECRETARIAT]);
    const token = await harness.keys.sign(staffClaims(SECRETARIAT.email));

    const id1 = "11111111-1111-4111-8111-111111111111";
    const id2 = "22222222-2222-4222-8222-222222222222";
    await seedRequest(harness.env, id1, { at: "2026-10-22T08:00:00.000Z" });
    await seedRequest(harness.env, id2, {
      at: "2026-10-22T08:01:00.000Z",
      status: "in_progress",
    });

    const allRes = await panelJsonCall(harness, "GET", "/requests", { token });
    expect(allRes.status).toBe(200);
    const all = panelRequestsListSchema.parse(await allRes.json());
    expect(all.items.map((item) => item.id)).toEqual([id2, id1]);
    expect(all.nextBefore).toBeNull();
    expect(JSON.stringify(all)).not.toMatch(/Jan|Kowalski|jan\.kowalski/u);

    const filteredRes = await panelJsonCall(harness, "GET", "/requests?status=in_progress", {
      token,
    });
    expect(filteredRes.status).toBe(200);
    const filtered = panelRequestsListSchema.parse(await filteredRes.json());
    expect(filtered.items.map((item) => item.id)).toEqual([id2]);

    const firstPage = panelRequestsListSchema.parse(
      await (await panelJsonCall(harness, "GET", "/requests?limit=1", { token })).json(),
    );
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextBefore).toBe(firstPage.items[0]?.createdAt);
    const secondPage = panelRequestsListSchema.parse(
      await (
        await panelJsonCall(
          harness,
          "GET",
          `/requests?limit=1&before=${String(firstPage.nextBefore)}`,
          { token },
        )
      ).json(),
    );
    expect(secondPage.items.map((item) => item.id)).toEqual([id1]);
    expect(secondPage.nextBefore).toBeNull();

    await expectProblem(await panelJsonCall(harness, "GET", "/requests?limit=999", { token }), 422);
    await expectProblem(
      await panelJsonCall(harness, "GET", "/requests?status=submitted&status=ready", { token }),
      422,
    );
    await expectProblem(
      await panelJsonCall(harness, "GET", "/requests", { token: "invalid" }),
      401,
    );
  });
});
