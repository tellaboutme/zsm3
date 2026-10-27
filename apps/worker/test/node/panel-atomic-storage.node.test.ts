import { it } from "vitest";

import { eventsSaveMutation, redirectSaveMutation, sampleEvent } from "./panel-fixtures.ts";
import { panelSpyHarness, SPY_ADMIN, spyStore, spyToken, spyTotal } from "./panel-spy.ts";
import {
  expectProblem,
  panelAudit,
  panelJsonCall,
  panelUploadRequest,
  seedStaff,
} from "./panel-support.ts";
import { redirectsRepo } from "../../src/storage/redirects-repo.ts";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x20]);

it("commits school year replacements and their audit rows in one batch", async ({ expect }) => {
  const harness = await panelSpyHarness();
  await seedStaff(harness.env, [SPY_ADMIN]);
  const token = await spyToken(harness);

  const saved = await panelJsonCall(harness, "PUT", "/events/2026", {
    token,
    body: eventsSaveMutation([sampleEvent("2026-09-15", "Rozpoczecie roku")]),
  });
  expect(saved.status).toBe(200);
  expect(harness.batches).toEqual([[expect.anything(), expect.anything(), expect.anything()]]);
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 1 });

  harness.failAudit();
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/events/2026", {
      token,
      body: eventsSaveMutation([sampleEvent("2026-10-11", "Dyskoteka")]),
    }),
    500,
  );
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM events")).toEqual({ total: 1 });
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 1 });
});

it("commits the school year clear and its audit row in one batch", async ({ expect }) => {
  const harness = await panelSpyHarness();
  await seedStaff(harness.env, [SPY_ADMIN]);
  const token = await spyToken(harness);
  await panelJsonCall(harness, "PUT", "/events/2026", {
    token,
    body: eventsSaveMutation([sampleEvent("2026-09-15", "Rozpoczecie roku")]),
  });

  const cleared = await panelJsonCall(harness, "PUT", "/events/2026", {
    token,
    body: { entity: "events", events: [] },
  });
  expect(cleared.status).toBe(200);
  expect(harness.batches.at(-1)).toHaveLength(2);
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM events")).toEqual({ total: 0 });
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 2 });
});

it("commits file registrations and their audit rows in one batch", async ({ expect }) => {
  const harness = await panelSpyHarness();
  await seedStaff(harness.env, [SPY_ADMIN]);
  const token = await spyToken(harness);

  const uploaded = await harness.app.fetch(
    panelUploadRequest(token, new File([PDF], "raport.pdf")),
    harness.env,
  );
  expect(uploaded.status).toBe(201);
  expect(harness.batches).toEqual([[expect.anything(), expect.anything()]]);
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM files")).toEqual({ total: 1 });
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 1 });

  harness.failAudit();
  const rejected = await harness.app.fetch(
    panelUploadRequest(token, new File([PDF], "inny.pdf")),
    harness.env,
  );
  expect(rejected.status).toBe(500);
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM files")).toEqual({ total: 1 });
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 1 });
});

it("commits redirect saves and deletions with their audit rows", async ({ expect }) => {
  const harness = await panelSpyHarness();
  await seedStaff(harness.env, [SPY_ADMIN]);
  const token = await spyToken(harness);
  const audit = panelAudit(harness.env);

  const saved = await panelJsonCall(harness, "PUT", "/redirects", {
    token,
    body: redirectSaveMutation({ from: "/wizytowka", to: "/kontakt" }),
  });
  expect(saved.status).toBe(200);
  expect(harness.batches).toEqual([[expect.anything(), expect.anything()]]);
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 1 });

  const removed = await panelJsonCall(harness, "DELETE", "/redirects/wizytowka", {
    token,
    body: {},
  });
  expect(removed.status).toBe(204);
  expect(harness.batches.at(-1)).toHaveLength(2);
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM redirects")).toEqual({ total: 0 });
  expect((await audit.byEntity("redirects", "/wizytowka", 10)).map((row) => row.action)).toEqual([
    "redirects.delete",
    "redirects.save",
  ]);

  const repo = redirectsRepo(spyStore(harness));
  await repo.save({ from: "/skrot", to: "/kontakt" });
  await repo.delete("/skrot/");
  expect(await repo.target("/skrot")).toBeUndefined();

  harness.failAudit();
  await panelJsonCall(harness, "PUT", "/redirects", {
    token,
    body: redirectSaveMutation({ from: "/powrot", to: "/kontakt" }),
  });
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 2 });
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM redirects")).toEqual({ total: 0 });
});
