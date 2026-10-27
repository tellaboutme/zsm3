import { panelStaffListSchema } from "@zsm3/contracts/panel";
import { it } from "vitest";
import { z } from "zod";

import { staffMember } from "./panel-fixtures.ts";
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

function staffBody(email: string, role: string, active: boolean): unknown {
  return { entity: "staff", item: { email, role, active } };
}

it("lists staff members with their roles", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN, staffMember("foto@zsm3.test", "gallery_editor", false)]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const response = await panelJsonCall(harness, "GET", "/staff", { token });
  const raw: unknown = await response.json();
  expect(response.status).toBe(200);
  expect(
    panelStaffListSchema.parse(raw).items.map(({ email, role, active }) => [email, role, active]),
  ).toEqual([
    ["admin@zsm3.test", "admin", true],
    ["foto@zsm3.test", "gallery_editor", false],
  ]);
});

it("adds a member, changes the role and records the changed fields", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const added = await panelJsonCall(harness, "PUT", "/staff", {
    token,
    body: staffBody(" Redaktor@ZSM3.test ", "editor", true),
  });
  expect(added.status).toBe(200);
  expect(await added.json()).toEqual({ ok: true });
  const changed = await panelJsonCall(harness, "PUT", "/staff", {
    token,
    body: staffBody("redaktor@zsm3.test", "secretariat", true),
  });
  expect(changed.status).toBe(200);

  const listed = panelStaffListSchema.parse(
    await (await panelJsonCall(harness, "GET", "/staff", { token })).json(),
  );
  expect(listed.items.find((item) => item.email === "redaktor@zsm3.test")?.role).toBe(
    "secretariat",
  );
  const audit = (await panelAudit(harness.env).byEntity("staff", "redaktor@zsm3.test", 10)).map(
    (row) => ({ actor: row.actorEmail, ...fieldsSchema.parse(JSON.parse(row.details)) }),
  );
  expect(audit).toHaveLength(2);
  expect(audit).toEqual(
    expect.arrayContaining([
      { actor: "admin@zsm3.test", fields: ["role"] },
      { actor: "admin@zsm3.test", fields: ["email", "role", "active"] },
    ]),
  );
});

it("deactivated members lose panel access", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN, staffMember("odchodzi@zsm3.test", "editor", true)]);
  const admin = await harness.keys.sign(staffClaims(ADMIN.email));
  const leaving = await harness.keys.sign(staffClaims("odchodzi@zsm3.test"));

  expect((await panelJsonCall(harness, "GET", "/me", { token: leaving })).status).toBe(200);
  await panelJsonCall(harness, "PUT", "/staff", {
    token: admin,
    body: staffBody("odchodzi@zsm3.test", "editor", false),
  });
  await expectProblem(await panelJsonCall(harness, "GET", "/me", { token: leaving }), 403);
});

it("keeps administrators from removing their own access", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const demoted = await expectProblem(
    await panelJsonCall(harness, "PUT", "/staff", {
      token,
      body: staffBody(ADMIN.email, "editor", true),
    }),
    422,
  );
  expect(demoted.title).toBe("Own Access Unchanged");
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/staff", {
      token,
      body: staffBody(ADMIN.email, "admin", false),
    }),
    422,
  );
  expect(
    (
      await panelJsonCall(harness, "PUT", "/staff", {
        token,
        body: staffBody(ADMIN.email, "admin", true),
      })
    ).status,
  ).toBe(200);
});

it("rejects malformed staff members", async () => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  for (const body of [
    staffBody("bez-domeny", "editor", true),
    staffBody("ktos@zsm3.test", "dyrektor", true),
    { entity: "redirects", item: { from: "/a", to: "/kontakt" } },
  ]) {
    await expectProblem(await panelJsonCall(harness, "PUT", "/staff", { token, body }), 422);
  }
});
