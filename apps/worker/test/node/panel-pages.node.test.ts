import { panelPageListSchema, panelPageViewSchema } from "@zsm3/contracts/panel";
import { it } from "vitest";
import { z } from "zod";

import { pageSaveMutation, samplePage, staffMember } from "./panel-fixtures.ts";
import {
  expectProblem,
  panelAudit,
  panelHarness,
  panelJsonCall,
  panelRevisions,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";

const ADMIN = staffMember("admin@zsm3.test", "admin", true);
const CONTACT = samplePage("/kontakt", "Kontakt");
const ABOUT = samplePage("/szkola/wspolpraca", "Wspolpraca");
const fieldsSchema = z.object({ fields: z.array(z.string()) });

it("lists pages without stored content", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const response = await panelJsonCall(harness, "GET", "/pages", { token });
  const raw: unknown = await response.json();

  expect(response.status).toBe(200);
  expect(panelPageListSchema.parse(raw)).toEqual({ items: [] });
});

it("saves a new page with created fields and shows it", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const created = await panelJsonCall(harness, "PUT", "/pages/kontakt", {
    token,
    body: pageSaveMutation(CONTACT, "published"),
  });
  expect(created.status).toBe(200);

  const listed = await panelJsonCall(harness, "GET", "/pages", { token });
  const pageRaw: unknown = await listed.json();
  expect(panelPageListSchema.parse(pageRaw)).toEqual({
    items: [{ path: "/kontakt", status: "published", title: "Kontakt" }],
  });

  const shown = await panelJsonCall(harness, "GET", "/pages/kontakt", { token });
  const viewRaw: unknown = await shown.json();
  expect(panelPageViewSchema.parse(viewRaw)).toEqual({ item: { ...CONTACT, status: "published" } });

  const saves = await panelAudit(harness.env).byEntity("pages", "/kontakt", 10);
  expect(saves[0]?.action).toBe("pages.save");
});

it("revisions the previous page on later saves", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await panelJsonCall(harness, "PUT", "/pages/kontakt", {
    token,
    body: pageSaveMutation(CONTACT, "draft"),
  });

  const changed = samplePage("/kontakt", "Kontakt ZSM3");
  const updated = await panelJsonCall(harness, "PUT", "/pages/kontakt", {
    token,
    body: pageSaveMutation(changed, "published"),
  });
  expect(updated.status).toBe(200);

  const revisions = await panelRevisions(harness.env).list("pages", "/kontakt");
  const revision = revisions[0];
  if (revision === undefined) {
    throw new Error("fixture");
  }
  expect(revision.revision).toBe(1);
  const stored: unknown = JSON.parse(revision.dataJson);
  expect(stored).toEqual({ ...CONTACT, status: "draft" });

  const saves = (await panelAudit(harness.env).byEntity("pages", "/kontakt", 10)).map((row) => {
    const details: unknown = JSON.parse(row.details);
    return fieldsSchema.parse(details);
  });
  expect(saves).toEqual([
    { fields: ["title"] },
    { fields: ["path", "kicker", "title", "intro", "sections"] },
  ]);
});

it("rejects mismatched and malformed page paths", async () => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await panelJsonCall(harness, "PUT", "/pages/kontakt", {
    token,
    body: pageSaveMutation(CONTACT, "draft"),
  });

  await expectProblem(
    await panelJsonCall(harness, "PUT", "/pages/kontakt", {
      token,
      body: pageSaveMutation(ABOUT, "draft"),
    }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/pages/Kontakt", {
      token,
      body: pageSaveMutation(CONTACT, "draft"),
    }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/pages/kontakt", {
      token,
      body: { entity: "news", mutation: { action: "save", item: {} } },
    }),
    422,
  );
  await expectProblem(await panelJsonCall(harness, "GET", "/pages/brak", { token }), 404);
  await expectProblem(await panelJsonCall(harness, "GET", "/pages/Kontakt", { token }), 422);
});
