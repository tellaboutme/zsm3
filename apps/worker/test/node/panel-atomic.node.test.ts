import { it } from "vitest";

import {
  newsSaveMutation,
  newsStatusMutation,
  pageSaveMutation,
  sampleNews,
  samplePage,
} from "./panel-fixtures.ts";
import { panelSpyHarness, SPY_ADMIN, spyStore, spyToken, spyTotal } from "./panel-spy.ts";
import { expectProblem, panelJsonCall, seedStaff } from "./panel-support.ts";
import { newsRepo } from "../../src/storage/news-repo.ts";

it("commits news creation and its audit row in a single batch", async ({ expect }) => {
  const harness = await panelSpyHarness();
  await seedStaff(harness.env, [SPY_ADMIN]);
  const token = await spyToken(harness);

  const created = await panelJsonCall(harness, "POST", "/news", {
    token,
    body: newsSaveMutation(sampleNews("salon-maturzystow", "Salon Maturzystow")),
  });
  expect(created.status).toBe(201);
  expect(harness.batches).toEqual([[expect.anything(), expect.anything(), expect.anything()]]);
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 1 });

  harness.failAudit();
  await expectProblem(
    await panelJsonCall(harness, "POST", "/news", {
      token,
      body: newsSaveMutation(sampleNews("drugi-salon", "Drugi salon")),
    }),
    500,
  );
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM news")).toEqual({ total: 1 });
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 1 });
});

it("commits news updates, revisions and audit in one batch", async ({ expect }) => {
  const harness = await panelSpyHarness();
  await seedStaff(harness.env, [SPY_ADMIN]);
  const token = await spyToken(harness);
  await newsRepo(spyStore(harness)).save(
    sampleNews("salon-maturzystow", "Salon Maturzystow"),
    "draft",
  );
  const beforeBatches = harness.batches.length;

  const updated = await panelJsonCall(harness, "PUT", "/news/2026/salon-maturzystow", {
    token,
    body: newsSaveMutation(sampleNews("salon-maturzystow", "Salon Maturzystow 2026")),
  });
  expect(updated.status).toBe(200);
  expect(harness.batches.length).toBe(beforeBatches + 1);
  expect(harness.batches.at(-1)).toHaveLength(4);
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM content_revisions")).toEqual({
    total: 1,
  });
  expect(
    spyTotal(harness, "SELECT COUNT(*) AS total FROM search_documents WHERE doc_id = 'p:/kontakt'"),
  ).toEqual({ total: 0 });
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 1 });

  harness.failAudit();
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/news/2026/salon-maturzystow", {
      token,
      body: newsSaveMutation(sampleNews("salon-maturzystow", "Inny tytul")),
    }),
    500,
  );
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM content_revisions")).toEqual({
    total: 1,
  });
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 1 });
  expect(
    harness.memory.sqlite.prepare("SELECT title FROM news WHERE slug = 'salon-maturzystow'").get(),
  ).toEqual({ title: "Salon Maturzystow 2026" });
});

it("commits publish flips, revisions and audit in one batch", async ({ expect }) => {
  const harness = await panelSpyHarness();
  await seedStaff(harness.env, [SPY_ADMIN]);
  const token = await spyToken(harness);
  await newsRepo(spyStore(harness)).save(
    sampleNews("salon-maturzystow", "Salon Maturzystow"),
    "draft",
  );
  const beforeBatches = harness.batches.length;

  const published = await panelJsonCall(harness, "PATCH", "/news/2026/salon-maturzystow", {
    token,
    body: newsStatusMutation("publish"),
  });
  expect(published.status).toBe(200);
  expect(harness.batches.length).toBe(beforeBatches + 1);
  expect(harness.batches.at(-1)).toHaveLength(5);
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM content_revisions")).toEqual({
    total: 1,
  });
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 1 });

  harness.failAudit();
  await expectProblem(
    await panelJsonCall(harness, "PATCH", "/news/2026/salon-maturzystow", {
      token,
      body: newsStatusMutation("unpublish"),
    }),
    500,
  );
  expect(
    harness.memory.sqlite.prepare("SELECT status FROM news WHERE slug = 'salon-maturzystow'").get(),
  ).toEqual({ status: "published" });
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM content_revisions")).toEqual({
    total: 1,
  });
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 1 });
});

it("commits page saves and their audit rows in a single batch", async ({ expect }) => {
  const harness = await panelSpyHarness();
  await seedStaff(harness.env, [SPY_ADMIN]);
  const token = await spyToken(harness);

  const created = await panelJsonCall(harness, "PUT", "/pages/kontakt", {
    token,
    body: pageSaveMutation(samplePage("/kontakt", "Kontakt"), "published"),
  });
  expect(created.status).toBe(200);
  expect(harness.batches).toEqual([
    [expect.anything(), expect.anything(), expect.anything(), expect.anything()],
  ]);
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 1 });
  expect(
    spyTotal(harness, "SELECT COUNT(*) AS total FROM search_documents WHERE doc_id = 'p:/kontakt'"),
  ).toEqual({ total: 1 });

  const revised = await panelJsonCall(harness, "PUT", "/pages/kontakt", {
    token,
    body: pageSaveMutation(samplePage("/kontakt", "Kontakty"), "draft"),
  });
  expect(revised.status).toBe(200);
  expect(harness.batches.at(-1)).toHaveLength(4);
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM content_revisions")).toEqual({
    total: 1,
  });

  harness.failAudit();
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/pages/kontakt", {
      token,
      body: pageSaveMutation(samplePage("/kontakt", "Nowy kontakt"), "draft"),
    }),
    500,
  );
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM content_revisions")).toEqual({
    total: 1,
  });
  expect(spyTotal(harness, "SELECT COUNT(*) AS total FROM audit_log")).toEqual({ total: 2 });
  expect(
    harness.memory.sqlite.prepare("SELECT title FROM pages WHERE path = '/kontakt'").get(),
  ).toEqual({
    title: "Kontakty",
  });
});
