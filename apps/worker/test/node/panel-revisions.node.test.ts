import { panelRevisionListSchema } from "@zsm3/contracts/revisions";
import { it } from "vitest";

import {
  newsSaveMutation,
  pageSaveMutation,
  sampleNews,
  samplePage,
  staffMember,
} from "./panel-fixtures.ts";
import type { PanelHarness } from "./panel-support.ts";
import {
  expectProblem,
  panelAudit,
  panelHarness,
  panelJsonCall,
  panelRevisions,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";

const EDITOR = staffMember("redakcja@zsm3.test", "editor", true);

async function signedIn(): Promise<{ harness: PanelHarness; token: string }> {
  const harness = await panelHarness();
  await seedStaff(harness.env, [EDITOR]);
  return { harness, token: await harness.keys.sign(staffClaims(EDITOR.email)) };
}

function restoreBody(target: string, id: string, revision: number): unknown {
  return { entity: "revisions", target, id, revision };
}

it("lists page versions newest first and restores one keeping the status", async ({ expect }) => {
  const { harness, token } = await signedIn();
  for (const title of ["Kontakt", "Kontakt szkoły", "Kontakt i dojazd"]) {
    await panelJsonCall(harness, "PUT", "/pages/kontakt", {
      token,
      body: pageSaveMutation(samplePage("/kontakt", title), "published"),
    });
  }

  const listed = panelRevisionListSchema.parse(
    await (await panelJsonCall(harness, "GET", "/revisions/pages?id=/kontakt", { token })).json(),
  );
  expect(listed.items.map(({ revision, title, status }) => [revision, title, status])).toEqual([
    [2, "Kontakt szkoły", "published"],
    [1, "Kontakt", "published"],
  ]);
  expect(listed.items[0]?.actorEmail).toBe(EDITOR.email);

  const restored = await panelJsonCall(harness, "POST", "/revisions/restore", {
    token,
    body: restoreBody("pages", "/kontakt", 1),
  });
  expect(restored.status).toBe(200);
  expect(await restored.json()).toEqual({ ok: true });
  const page = await panelJsonCall(harness, "GET", "/pages/kontakt", { token });
  expect(await page.json()).toMatchObject({ item: { title: "Kontakt", status: "published" } });
  const latest = await panelRevisions(harness.env).latest("pages", "/kontakt");
  expect(latest?.revision).toBe(3);
  expect(JSON.parse(latest?.dataJson ?? "{}")).toMatchObject({
    title: "Kontakt i dojazd",
    status: "published",
  });
  const [audit] = await panelAudit(harness.env).byEntity("pages", "/kontakt", 1);
  expect(audit?.action).toBe("pages.restore");
});

it("restores a news version under the same address", async ({ expect }) => {
  const { harness, token } = await signedIn();
  await panelJsonCall(harness, "POST", "/news", {
    token,
    body: newsSaveMutation(sampleNews("salon", "Salon maturzystów")),
  });
  await panelJsonCall(harness, "PUT", "/news/2026/salon", {
    token,
    body: newsSaveMutation(sampleNews("salon", "Salon maturzystów 2026")),
  });

  const restored = await panelJsonCall(harness, "POST", "/revisions/restore", {
    token,
    body: restoreBody("news", "2026/salon", 1),
  });
  expect(restored.status).toBe(200);
  const item = await panelJsonCall(harness, "GET", "/news/2026/salon", { token });
  expect(await item.json()).toMatchObject({
    item: { title: "Salon maturzystów", status: "draft" },
  });
  const latest = await panelRevisions(harness.env).latest("news", "2026/salon");
  expect(JSON.parse(latest?.dataJson ?? "{}")).toMatchObject({
    title: "Salon maturzystów 2026",
    status: "draft",
  });
  const listed = panelRevisionListSchema.parse(
    await (await panelJsonCall(harness, "GET", "/revisions/news?id=2026/salon", { token })).json(),
  );
  expect(listed.items.map(({ status }) => status)).toEqual(["draft", "draft"]);
});

it("refuses unknown, unreadable and mismatched versions", async () => {
  const { harness, token } = await signedIn();
  const revisions = panelRevisions(harness.env);
  await panelJsonCall(harness, "PUT", "/pages/kontakt", {
    token,
    body: pageSaveMutation(samplePage("/kontakt", "Kontakt"), "published"),
  });
  await revisions.append("pages", "/kontakt", JSON.stringify({ title: "zly" }), EDITOR.email);
  await revisions.append(
    "pages",
    "/brak",
    JSON.stringify({ ...samplePage("/brak", "Brak"), status: "draft" }),
    EDITOR.email,
  );
  await revisions.append(
    "news",
    "2026/brak",
    JSON.stringify({ ...sampleNews("brak", "Brak"), status: "draft" }),
    EDITOR.email,
  );
  await revisions.append(
    "news",
    "2026/inny",
    JSON.stringify({ ...sampleNews("brak", "Brak"), status: "draft" }),
    EDITOR.email,
  );
  await panelJsonCall(harness, "POST", "/news", {
    token,
    body: newsSaveMutation(sampleNews("inny", "Inny")),
  });
  await revisions.append("news", "2026/zla", JSON.stringify({ title: "zly" }), EDITOR.email);
  const inny = JSON.stringify({ ...sampleNews("inny", "Inny"), status: "draft" });
  await revisions.append("news", "x2026/inny", inny, EDITOR.email);
  await revisions.append("news", "2026/inny/x", inny, EDITOR.email);
  await revisions.append(
    "news",
    "2026/inny",
    JSON.stringify({ ...sampleNews("inny", "Inny", { date: "2025-09-14" }), status: "draft" }),
    EDITOR.email,
  );
  await revisions.append(
    "pages",
    "/kontakt",
    JSON.stringify({ ...samplePage("/inna", "Inna"), status: "draft" }),
    EDITOR.email,
  );

  const cases: readonly [unknown, number][] = [
    [restoreBody("pages", "/kontakt", 9), 404],
    [restoreBody("pages", "/kontakt", 1), 422],
    [restoreBody("pages", "/brak", 1), 404],
    [restoreBody("news", "2026/brak", 1), 404],
    [restoreBody("news", "2026/inny", 1), 422],
    [restoreBody("news", "2026/zla", 1), 422],
    [restoreBody("news", "x2026/inny", 1), 422],
    [restoreBody("news", "2026/inny/x", 1), 422],
    [restoreBody("news", "2026/inny", 2), 422],
    [restoreBody("pages", "/kontakt", 2), 422],
    [restoreBody("kalendarz", "/kontakt", 1), 422],
    [{ entity: "redirects", item: { from: "/a", to: "/kontakt" } }, 422],
  ];
  for (const [body, status] of cases) {
    await expectProblem(
      await panelJsonCall(harness, "POST", "/revisions/restore", { token, body }),
      status,
    );
  }
  await expectProblem(
    await panelJsonCall(harness, "GET", "/revisions/kalendarz?id=/a", { token }),
    422,
  );
  await expectProblem(await panelJsonCall(harness, "GET", "/revisions/pages", { token }), 422);
});

it("skips stored versions that are not readable in the list", async ({ expect }) => {
  const { harness, token } = await signedIn();
  await panelRevisions(harness.env).append(
    "pages",
    "/kontakt",
    JSON.stringify({ x: 1 }),
    EDITOR.email,
  );

  const listed = await panelJsonCall(harness, "GET", "/revisions/pages?id=/kontakt", { token });
  expect(panelRevisionListSchema.parse(await listed.json()).items).toEqual([]);
});
