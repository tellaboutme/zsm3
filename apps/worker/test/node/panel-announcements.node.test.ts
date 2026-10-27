import { announcementListSchema } from "@zsm3/contracts/announcements";
import { it } from "vitest";
import { z } from "zod";

import { staffMember } from "./panel-fixtures.ts";
import type { PanelHarness } from "./panel-support.ts";
import {
  expectProblem,
  panelAudit,
  panelHarness,
  panelJsonCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";

const EDITOR = staffMember("redakcja@zsm3.test", "editor", true);
const ITEM = {
  severity: "important",
  text: "W piątek lekcje skrócone.",
  link: { label: "Dzwonki", href: "/uczniowie/dzwonki" },
  startsOn: "2026-10-23",
  endsOn: "2026-10-23",
};
const fieldsSchema = z.object({ fields: z.array(z.string()) });

async function signedIn(): Promise<{ harness: PanelHarness; token: string }> {
  const harness = await panelHarness();
  await seedStaff(harness.env, [EDITOR]);
  return { harness, token: await harness.keys.sign(staffClaims(EDITOR.email)) };
}

async function listed(
  harness: PanelHarness,
  token: string,
): Promise<z.infer<typeof announcementListSchema>> {
  const response = await panelJsonCall(harness, "GET", "/announcements", { token });
  return announcementListSchema.parse(await response.json());
}

it("creates, edits and deletes an announcement with an audit trail", async ({ expect }) => {
  const { harness, token } = await signedIn();

  const created = await panelJsonCall(harness, "POST", "/announcements", {
    token,
    body: { entity: "announcements", item: ITEM },
  });
  expect(created.status).toBe(201);
  expect(await created.json()).toEqual({ ok: true });
  const [stored] = (await listed(harness, token)).items;
  expect(stored).toMatchObject(ITEM);
  const id = stored?.id ?? "";

  const withoutLink = {
    severity: ITEM.severity,
    text: ITEM.text,
    startsOn: ITEM.startsOn,
    endsOn: ITEM.endsOn,
  };
  const updated = await panelJsonCall(harness, "PUT", `/announcements/${id}`, {
    token,
    body: { entity: "announcements", item: { ...withoutLink, severity: "urgent" } },
  });
  expect(updated.status).toBe(200);
  expect(await updated.json()).toEqual({ ok: true });
  expect((await listed(harness, token)).items[0]).toMatchObject({ severity: "urgent" });
  expect((await listed(harness, token)).items[0]?.link).toBeUndefined();

  const removed = await panelJsonCall(harness, "DELETE", `/announcements/${id}`, {
    token,
    body: {},
  });
  expect(removed.status).toBe(204);
  expect((await listed(harness, token)).items).toEqual([]);

  const audit = (await panelAudit(harness.env).byEntity("announcements", id, 10)).map((row) => ({
    action: row.action,
    ...fieldsSchema.parse(JSON.parse(row.details)),
  }));
  expect(audit).toHaveLength(3);
  expect(audit).toEqual(
    expect.arrayContaining([
      { action: "announcements.delete", fields: ["text"] },
      { action: "announcements.update", fields: ["severity", "link"] },
      {
        action: "announcements.create",
        fields: ["severity", "text", "link", "startsOn", "endsOn"],
      },
    ]),
  );
});

it("rejects invalid announcements and unknown identifiers", async () => {
  const { harness, token } = await signedIn();
  const missing = "01920000-0000-7000-8000-000000000000";

  for (const item of [
    { ...ITEM, endsOn: "2026-10-22" },
    { ...ITEM, text: "" },
    { ...ITEM, link: { label: "Zły", href: "http://example.com" } },
    { ...ITEM, severity: "krytyczne" },
  ]) {
    await expectProblem(
      await panelJsonCall(harness, "POST", "/announcements", {
        token,
        body: { entity: "announcements", item },
      }),
      422,
    );
  }
  await expectProblem(
    await panelJsonCall(harness, "PUT", `/announcements/${missing}`, {
      token,
      body: { entity: "announcements", item: ITEM },
    }),
    404,
  );
  await expectProblem(
    await panelJsonCall(harness, "DELETE", "/announcements/nie-uuid", { token, body: {} }),
    422,
  );
});

it("rejects an update without an announcement body", async () => {
  const { harness, token } = await signedIn();
  await panelJsonCall(harness, "POST", "/announcements", {
    token,
    body: { entity: "announcements", item: ITEM },
  });
  const id = (await listed(harness, token)).items[0]?.id ?? "";

  await expectProblem(
    await panelJsonCall(harness, "PUT", `/announcements/${id}`, {
      token,
      body: { entity: "redirects", item: { from: "/a", to: "/kontakt" } },
    }),
    422,
  );
});
