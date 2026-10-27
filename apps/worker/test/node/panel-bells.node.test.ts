import { bellScheduleViewSchema } from "@zsm3/contracts/bells";
import { it } from "vitest";
import { z } from "zod";

import { staffMember } from "./panel-fixtures.ts";
import { BELLS } from "./panel-matrix-site.ts";
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
const fieldsSchema = z.object({ fields: z.array(z.string()) });

async function signedIn(): Promise<{ harness: PanelHarness; token: string }> {
  const harness = await panelHarness();
  await seedStaff(harness.env, [EDITOR]);
  return { harness, token: await harness.keys.sign(staffClaims(EDITOR.email)) };
}

async function emptyBells(harness: PanelHarness): Promise<void> {
  await harness.env.DB.prepare("DELETE FROM bell_schedule").run();
}

it("starts from the regular schedule set by the migration", async ({ expect }) => {
  const { harness, token } = await signedIn();

  const response = await panelJsonCall(harness, "GET", "/bells", { token });
  const { schedule } = bellScheduleViewSchema.parse(await response.json());
  expect(schedule.regular).toHaveLength(14);
  expect(schedule.regular[0]).toEqual({ start: "07:30", end: "08:15" });
  expect(schedule.variants).toEqual([]);
});

it("saves the whole schedule and audits what changed", async ({ expect }) => {
  const { harness, token } = await signedIn();

  const saved = await panelJsonCall(harness, "PUT", "/bells", { token, body: BELLS });
  expect(saved.status).toBe(200);
  expect(await saved.json()).toEqual({ ok: true });
  const response = await panelJsonCall(harness, "GET", "/bells", { token });
  expect(bellScheduleViewSchema.parse(await response.json()).schedule).toEqual(BELLS.schedule);
  const audit = (await panelAudit(harness.env).byEntity("bells", "schedule", 10)).map((row) =>
    fieldsSchema.parse(JSON.parse(row.details)),
  );
  expect(audit).toEqual([{ fields: ["regular", "variants", "days"] }]);
});

it("answers 404 before any schedule exists and then accepts the first one", async ({ expect }) => {
  const { harness, token } = await signedIn();
  await emptyBells(harness);

  await expectProblem(await panelJsonCall(harness, "GET", "/bells", { token }), 404);
  expect((await panelJsonCall(harness, "PUT", "/bells", { token, body: BELLS })).status).toBe(200);
  const [audit] = await panelAudit(harness.env).byEntity("bells", "schedule", 1);
  expect(fieldsSchema.parse(JSON.parse(audit?.details ?? "{}"))).toEqual({
    fields: ["regular", "variants", "days"],
  });
});

it("rejects inconsistent schedules", async () => {
  const { harness, token } = await signedIn();
  const { schedule } = BELLS;

  for (const broken of [
    { ...schedule, regular: [] },
    { ...schedule, regular: [{ start: "09:00", end: "08:00" }] },
    {
      ...schedule,
      regular: [
        { start: "08:00", end: "08:45" },
        { start: "08:40", end: "09:25" },
      ],
    },
    { ...schedule, regular: [{ start: "8:00", end: "08:45" }] },
    { ...schedule, days: [{ date: "2026-10-30", variant: "brak" }] },
    { ...schedule, days: [...schedule.days, ...schedule.days] },
    { ...schedule, variants: [...schedule.variants, ...schedule.variants] },
  ]) {
    await expectProblem(
      await panelJsonCall(harness, "PUT", "/bells", {
        token,
        body: { entity: "bells", schedule: broken },
      }),
      422,
    );
  }
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/bells", {
      token,
      body: { entity: "redirects", item: { from: "/a", to: "/kontakt" } },
    }),
    422,
  );
});
