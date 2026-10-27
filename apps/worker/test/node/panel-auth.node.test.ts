import { panelMeSchema } from "@zsm3/contracts/panel";
import { it } from "vitest";

import { staffMember } from "./panel-fixtures.ts";
import {
  expectProblem,
  panelHarness,
  panelJsonCall,
  panelRawCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";

const ADMIN = staffMember("admin@zsm3.test", "admin", true);
const EDITOR = staffMember("foto@zsm3.test", "gallery_editor", true);
const LEAVING = staffMember("odejscie@zsm3.test", "secretariat", false);

it("answers /me with the active staff role", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN, EDITOR, LEAVING]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const response = await panelJsonCall(harness, "GET", "/me", { token });

  expect(response.status).toBe(200);
  const payload: unknown = await response.json();
  expect(panelMeSchema.parse(payload)).toEqual({ email: ADMIN.email, role: "admin" });
});

it("answers /me for every staff role", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN, EDITOR, LEAVING]);
  const token = await harness.keys.sign(staffClaims(EDITOR.email));

  const response = await panelJsonCall(harness, "GET", "/me", { token });

  expect(response.status).toBe(200);
  const payload: unknown = await response.json();
  expect(panelMeSchema.parse(payload)).toEqual({ email: EDITOR.email, role: "gallery_editor" });
});

it("accepts the access jwt assertion header", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const response = await panelRawCall(harness, "GET", "/me", {
    headers: { "cf-access-jwt-assertion": token },
  });

  expect(response.status).toBe(200);
  const payload: unknown = await response.json();
  expect(panelMeSchema.parse(payload).email).toBe(ADMIN.email);
});

it("ignores a blank assertion header and keeps the bearer token", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const response = await panelRawCall(harness, "GET", "/me", {
    headers: { "cf-access-jwt-assertion": " ", authorization: `Bearer ${token}` },
  });

  expect(response.status).toBe(200);
  const payload: unknown = await response.json();
  expect(panelMeSchema.parse(payload).email).toBe(ADMIN.email);
});

it("rejects requests without a token", async () => {
  const harness = await panelHarness();

  await expectProblem(await panelRawCall(harness, "GET", "/me", { headers: {} }), 401);
});

it("rejects non-bearer authorization", async () => {
  const harness = await panelHarness();

  await expectProblem(
    await panelRawCall(harness, "GET", "/me", { headers: { authorization: "Basic abcd" } }),
    401,
  );
});

it("rejects malformed tokens", async () => {
  const harness = await panelHarness();

  await expectProblem(await panelJsonCall(harness, "GET", "/me", { token: "garbage" }), 401);
});

it("rejects expired tokens", async () => {
  const harness = await panelHarness();
  const token = await harness.keys.sign(staffClaims(ADMIN.email, { exp: 1_800_000_000 }));

  await expectProblem(await panelJsonCall(harness, "GET", "/me", { token }), 401);
});

it("rejects tokens from an unexpected issuer", async () => {
  const harness = await panelHarness();
  const token = await harness.keys.sign(staffClaims(ADMIN.email, { iss: "https://evil.example" }));

  await expectProblem(await panelJsonCall(harness, "GET", "/me", { token }), 401);
});

it("rejects valid tokens without a staff row", async () => {
  const harness = await panelHarness();
  const token = await harness.keys.sign(staffClaims("nieobecny@zsm3.test"));

  await expectProblem(await panelJsonCall(harness, "GET", "/me", { token }), 403);
});

it("rejects deactivated staff members", async () => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [LEAVING]);
  const token = await harness.keys.sign(staffClaims(LEAVING.email));

  await expectProblem(await panelJsonCall(harness, "GET", "/me", { token }), 403);
});
