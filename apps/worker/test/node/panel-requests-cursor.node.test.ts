import { panelRequestsListSchema } from "@zsm3/contracts/panel-requests";
import { describe, expect, it } from "vitest";

import { SECRETARIAT, seedRequest } from "./panel-requests-support.ts";
import { panelHarness, panelJsonCall, seedStaff, staffClaims } from "./panel-support.ts";

const SAME_TIME = "2026-10-22T08:00:00.000Z";
const IDS = [
  "33333333-3333-4333-8333-333333333331",
  "33333333-3333-4333-8333-333333333332",
  "33333333-3333-4333-8333-333333333333",
];

describe("panel requests cursor", () => {
  it("pages through requests created in the same millisecond without losing any", async () => {
    const harness = await panelHarness();
    await seedStaff(harness.env, [SECRETARIAT]);
    const token = await harness.keys.sign(staffClaims(SECRETARIAT.email));
    for (const id of IDS) {
      await seedRequest(harness.env, id, { at: SAME_TIME });
    }

    const seen: string[] = [];
    let query = "/requests?limit=1";
    for (let page = 0; page < IDS.length + 1; page += 1) {
      const body = panelRequestsListSchema.parse(
        await (await panelJsonCall(harness, "GET", query, { token })).json(),
      );
      seen.push(...body.items.map((item) => item.id));
      if (body.nextBefore === null) {
        break;
      }
      query = `/requests?limit=1&before=${body.nextBefore}&beforeId=${String(body.nextBeforeId)}`;
    }

    expect(seen).toEqual(IDS.toReversed());

    const legacy = panelRequestsListSchema.parse(
      await (
        await panelJsonCall(harness, "GET", `/requests?before=${SAME_TIME}`, { token })
      ).json(),
    );
    expect(legacy).toEqual({ items: [], nextBefore: null, nextBeforeId: null });
  });
});
