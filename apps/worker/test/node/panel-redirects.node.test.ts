import { panelRedirectListSchema } from "@zsm3/contracts/panel";
import { it } from "vitest";
import { z } from "zod";

import { redirectSaveMutation, samplePage, staffMember } from "./panel-fixtures.ts";
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

it("answers an empty redirect list", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const response = await panelJsonCall(harness, "GET", "/redirects", { token });
  const raw: unknown = await response.json();
  expect(response.status).toBe(200);
  expect(panelRedirectListSchema.parse(raw)).toEqual({ items: [] });
});

it("saves, lowers and updates redirect targets", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  expect(
    (
      await panelJsonCall(harness, "PUT", "/redirects", {
        token,
        body: redirectSaveMutation({ from: "/Nowa-Wizytowka/", to: "/kontakt" }),
      })
    ).status,
  ).toBe(200);

  const listed = await panelJsonCall(harness, "GET", "/redirects", { token });
  const raw: unknown = await listed.json();
  expect(panelRedirectListSchema.parse(raw)).toEqual({
    items: [{ from: "/nowa-wizytowka", to: "/kontakt" }],
  });

  const saves = (await panelAudit(harness.env).byEntity("redirects", "/nowa-wizytowka", 10)).map(
    (row) => fieldsSchema.parse(JSON.parse(row.details)),
  );
  expect(saves).toEqual([{ fields: ["from", "to"] }]);

  expect(
    (
      await panelJsonCall(harness, "PUT", "/redirects", {
        token,
        body: redirectSaveMutation({ from: "/nowa-wizytowka", to: "/szkola/historia" }),
      })
    ).status,
  ).toBe(200);

  const updates = (await panelAudit(harness.env).byEntity("redirects", "/nowa-wizytowka", 10)).map(
    (row) => fieldsSchema.parse(JSON.parse(row.details)),
  );
  expect(updates).toHaveLength(2);
  expect(updates).toEqual(expect.arrayContaining([{ fields: ["to"] }, { fields: ["from", "to"] }]));
});

it("rejects saves without a redirect item", async () => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  await expectProblem(
    await panelJsonCall(harness, "PUT", "/redirects", {
      token,
      body: { entity: "pages", action: "save", page: samplePage("/kontakt", "Kontakt") },
    }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/redirects", {
      token,
      body: { entity: "redirects", item: { from: "/kontakt", to: "/kontakt" } },
    }),
    422,
  );
});

it("deletes stored redirects and misses unknown ones", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await panelJsonCall(harness, "PUT", "/redirects", {
    token,
    body: redirectSaveMutation({ from: "/nowa-wizytowka", to: "/kontakt" }),
  });

  const removed = await panelJsonCall(harness, "DELETE", "/redirects/nowa-wizytowka", {
    token,
    body: {},
  });
  expect(removed.status).toBe(204);

  const listed = await panelJsonCall(harness, "GET", "/redirects", { token });
  const raw: unknown = await listed.json();
  expect(panelRedirectListSchema.parse(raw)).toEqual({ items: [] });

  const removedRows = (
    await panelAudit(harness.env).byEntity("redirects", "/nowa-wizytowka", 10)
  ).map((row) => fieldsSchema.parse(JSON.parse(row.details)));
  expect(removedRows).toHaveLength(2);
  expect(removedRows).toEqual(
    expect.arrayContaining([{ fields: ["from"] }, { fields: ["from", "to"] }]),
  );

  await expectProblem(
    await panelJsonCall(harness, "DELETE", "/redirects/brak", { token, body: {} }),
    404,
  );
});

it("rejects malformed redirect paths", async () => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  await expectProblem(
    await panelJsonCall(harness, "DELETE", "/redirects/brak/sciezka%3Fdluga", { token, body: {} }),
    404,
  );
  await expectProblem(
    await panelJsonCall(harness, "DELETE", `/redirects/${"a".repeat(600)}`, { token, body: {} }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "DELETE", "/redirects/nowa-wizytowka", { token }),
    403,
  );
});
