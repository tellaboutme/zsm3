import { panelShortLinksListSchema } from "@zsm3/contracts/panel";
import { it } from "vitest";

import { staffMember } from "./panel-fixtures.ts";
import { panelHarness, panelJsonCall, seedStaff, staffClaims } from "./panel-support.ts";
import { systemClock } from "../../src/storage/database.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

it("returns no continuation when the result count exactly equals the limit", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [staffMember("editor@zsm3.test", "editor", true)]);
  const links = shortLinksRepo({ db: harness.env.DB, clock: systemClock, random: cryptoRandom });
  await links.create({
    code: "k7mq4ra",
    target: "https://example.org/materialy",
    password: null,
    createdBy: "editor@zsm3.test",
    expiresAt: "2027-10-22T08:00:00.000Z",
  });
  const token = await harness.keys.sign(staffClaims("editor@zsm3.test"));
  const response = await panelJsonCall(harness, "GET", "/short-links?limit=1", { token });
  const raw: unknown = await response.json();
  const page = panelShortLinksListSchema.parse(raw);
  expect(page.items.map((item) => item.code)).toEqual(["k7mq4ra"]);
  expect(page.nextCursor).toBeNull();
  const params = new URLSearchParams({
    limit: "1",
    beforeCreatedAt: page.items[0]?.createdAt ?? "",
    beforeCode: "k7mq4ra",
  });
  const nextResponse = await panelJsonCall(harness, "GET", `/short-links?${params.toString()}`, {
    token,
  });
  const nextRaw: unknown = await nextResponse.json();
  expect(panelShortLinksListSchema.parse(nextRaw)).toEqual({ items: [], nextCursor: null });
});
