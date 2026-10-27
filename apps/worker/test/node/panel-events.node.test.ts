import { panelEventListSchema } from "@zsm3/contracts/panel";
import { it } from "vitest";
import { z } from "zod";

import { eventsSaveMutation, sampleEvent, staffMember } from "./panel-fixtures.ts";
import {
  expectProblem,
  panelAudit,
  panelHarness,
  panelJsonCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";

const ADMIN = staffMember("admin@zsm3.test", "admin", true);
const fieldsSchema = z.object({ fields: z.array(z.string()) });
it("answers with an empty school year before events exist", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const response = await panelJsonCall(harness, "GET", "/events/2030", { token });
  const raw: unknown = await response.json();
  expect(response.status).toBe(200);
  expect(panelEventListSchema.parse(raw)).toEqual({ items: [] });
});

it("replaces one school year and reads it back", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  const events = [
    sampleEvent("2026-09-15", "Rozpoczecie roku"),
    { ...sampleEvent("2027-06-30", "Wakacje ilongi"), endDate: "2027-07-02" },
  ];

  expect(
    (
      await panelJsonCall(harness, "PUT", "/events/2026", {
        token,
        body: eventsSaveMutation(events),
      })
    ).status,
  ).toBe(200);

  const listed = await panelJsonCall(harness, "GET", "/events/2026", { token });
  const raw: unknown = await listed.json();
  expect(panelEventListSchema.parse(raw)).toEqual({ items: events });

  const saves = await panelAudit(harness.env).byEntity("events", "2026/2027", 10);
  const save = saves[0];
  if (save === undefined) {
    throw new Error("fixture");
  }
  expect(fieldsSchema.parse(JSON.parse(save.details))).toEqual({ fields: ["events"] });
});

it("clears the year when replaced with other events", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  const events = [sampleEvent("2026-09-15", "Rozpoczecie roku")];
  await panelJsonCall(harness, "PUT", "/events/2026", { token, body: eventsSaveMutation(events) });

  expect(
    (
      await panelJsonCall(harness, "PUT", "/events/2026", {
        token,
        body: eventsSaveMutation([sampleEvent("2026-08-01", "Prace techniczne")]),
      })
    ).status,
  ).toBe(200);

  const listed = await panelJsonCall(harness, "GET", "/events/2026", { token });
  const raw: unknown = await listed.json();
  expect(panelEventListSchema.parse(raw).items.map((row) => row.title)).toEqual([
    "Prace techniczne",
  ]);
});

it("rejects malformed school years and payloads", async () => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  await expectProblem(await panelJsonCall(harness, "GET", "/events/20x6", { token }), 422);
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/events/2026", {
      token,
      body: { entity: "pages", action: "save" },
    }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/events/2026", {
      token,
      body: eventsSaveMutation([
        { ...sampleEvent("2026-09-15", "Bledna data"), endDate: "2026-09-14" },
      ]),
    }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/events/0020", { token, body: {} }),
    422,
  );
});

it("rejects events outside the replaced school year", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  const events = [sampleEvent("2026-09-15", "Rozpoczecie roku")];
  await panelJsonCall(harness, "PUT", "/events/2026", { token, body: eventsSaveMutation(events) });

  const tooEarly = await panelJsonCall(harness, "PUT", "/events/2026", {
    token,
    body: eventsSaveMutation([sampleEvent("2025-06-30", "Poprzedni rok")]),
  });
  expect(tooEarly.status).toBe(422);
  const problem: unknown = await tooEarly.json();
  expect(problem).toEqual(expect.objectContaining({ title: "Event Outside School Year" }));

  await expectProblem(
    await panelJsonCall(harness, "PUT", "/events/2026", {
      token,
      body: eventsSaveMutation([
        { ...sampleEvent("2027-05-01", "Koniec roku"), endDate: "2028-01-02" },
      ]),
    }),
    422,
  );

  const listed = await panelJsonCall(harness, "GET", "/events/2026", { token });
  const raw: unknown = await listed.json();
  expect(panelEventListSchema.parse(raw)).toEqual({ items: events });
});

it("accepts the inclusive school year boundaries", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  expect(
    (
      await panelJsonCall(harness, "PUT", "/events/2026", {
        token,
        body: eventsSaveMutation([
          sampleEvent("2026-08-01", "Pierwszy dzien"),
          { ...sampleEvent("2027-07-30", "Ostatni dzien"), endDate: "2027-07-31" },
        ]),
      })
    ).status,
  ).toBe(200);

  const listed = await panelJsonCall(harness, "GET", "/events/2026", { token });
  const raw: unknown = await listed.json();
  expect(panelEventListSchema.parse(raw)).toEqual({
    items: [
      sampleEvent("2026-08-01", "Pierwszy dzien"),
      { ...sampleEvent("2027-07-30", "Ostatni dzien"), endDate: "2027-07-31" },
    ],
  });
});

it("clears the whole school year with an empty event list", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  const events = [sampleEvent("2026-09-15", "Rozpoczecie roku")];
  await panelJsonCall(harness, "PUT", "/events/2026", { token, body: eventsSaveMutation(events) });

  expect(
    (
      await panelJsonCall(harness, "PUT", "/events/2026", {
        token,
        body: { entity: "events", events: [] },
      })
    ).status,
  ).toBe(200);

  const listed = await panelJsonCall(harness, "GET", "/events/2026", { token });
  const raw: unknown = await listed.json();
  expect(panelEventListSchema.parse(raw)).toEqual({ items: [] });
  const saves = await panelAudit(harness.env).byEntity("events", "2026/2027", 10);
  expect(saves.map((row) => row.action)).toEqual(["events.save", "events.save"]);
});
