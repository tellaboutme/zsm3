import { panelAuditListSchema } from "@zsm3/contracts/audit";
import { it } from "vitest";

import { staffMember } from "./panel-fixtures.ts";
import type { PanelHarness } from "./panel-support.ts";
import {
  expectProblem,
  panelHarness,
  panelJsonCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";
import { auditRepo } from "../../src/storage/audit-repo.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";

const ADMIN = staffMember("admin@zsm3.test", "admin", true);

async function signedIn(): Promise<{ harness: PanelHarness; token: string }> {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  return { harness, token: await harness.keys.sign(staffClaims(ADMIN.email)) };
}

async function writeEntries(harness: PanelHarness, details: readonly string[]): Promise<void> {
  let now = Date.parse("2026-10-01T08:00:00Z");
  const audit = auditRepo({ db: harness.env.DB, clock: () => new Date(now), random: cryptoRandom });
  for (const [index, detail] of details.entries()) {
    now += 1000;
    await audit.append({
      actorEmail: "redakcja@zsm3.test",
      action: "news.update",
      entity: "news",
      entityId: `2026/wpis-${String(index)}`,
      details: detail,
    });
  }
}

it("lists the newest entries first with their changed fields", async ({ expect }) => {
  const { harness, token } = await signedIn();
  await writeEntries(harness, ['{"fields":["title"]}', "[1]", '{"retained":3}']);

  const response = await panelJsonCall(harness, "GET", "/audit", { token });
  const list = panelAuditListSchema.parse(await response.json());
  expect(list.next).toBeNull();
  expect(list.items.map(({ entityId, fields }) => [entityId, fields])).toEqual([
    ["2026/wpis-2", []],
    ["2026/wpis-1", []],
    ["2026/wpis-0", ["title"]],
  ]);
  expect(list.items[0]).toMatchObject({
    actorEmail: "redakcja@zsm3.test",
    action: "news.update",
    entity: "news",
    at: "2026-10-01T08:00:03.000Z",
  });
});

it("pages through older entries with a cursor", async ({ expect }) => {
  const { harness, token } = await signedIn();
  await writeEntries(
    harness,
    Array.from({ length: 55 }, () => '{"fields":["lead"]}'),
  );

  const first = panelAuditListSchema.parse(
    await (await panelJsonCall(harness, "GET", "/audit", { token })).json(),
  );
  expect(first.items).toHaveLength(50);
  expect(first.items[0]?.entityId).toBe("2026/wpis-54");
  expect(first.next).toMatch(/^2026-10-01T08:00:06\.000Z\|/u);

  const second = panelAuditListSchema.parse(
    await (
      await panelJsonCall(harness, "GET", `/audit?before=${encodeURIComponent(first.next ?? "")}`, {
        token,
      })
    ).json(),
  );
  expect(second.items.map(({ entityId }) => entityId)).toEqual([
    "2026/wpis-4",
    "2026/wpis-3",
    "2026/wpis-2",
    "2026/wpis-1",
    "2026/wpis-0",
  ]);
  expect(second.next).toBeNull();
});

it("rejects a malformed cursor", async () => {
  const { harness, token } = await signedIn();
  await expectProblem(await panelJsonCall(harness, "GET", "/audit?before=zly", { token }), 422);
});
