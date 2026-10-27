import { panelNewsListSchema } from "@zsm3/contracts/panel";
import { expect, it } from "vitest";

import { newsSaveMutation, newsStatusMutation, sampleNews, staffMember } from "./panel-fixtures.ts";
import {
  expectProblem,
  panelAudit,
  panelHarness,
  panelJsonCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";

const ADMIN = staffMember("admin@zsm3.test", "admin", true);
const SALON = sampleNews("salon-maturzystow", "Salon Maturzystow");
const OPEN = sampleNews("otwarcie-warsztatow", "Otwarcie warsztatow", { date: "2026-09-05" });
const GAGES = sampleNews("wynajem-sali", "Wynajem sali", {
  date: "2025-05-05",
  category: "Wynajem",
});

async function draftsOf(
  harness: Awaited<ReturnType<typeof panelHarness>>,
  token: string,
): Promise<void> {
  await panelJsonCall(harness, "POST", "/news", { token, body: newsSaveMutation(SALON) });
  await panelJsonCall(harness, "POST", "/news", { token, body: newsSaveMutation(OPEN) });
  await panelJsonCall(harness, "POST", "/news", { token, body: newsSaveMutation(GAGES) });
}

async function listQuery(
  harness: Awaited<ReturnType<typeof panelHarness>>,
  token: string,
  query: string,
): Promise<ReturnType<typeof panelNewsListSchema.parse>> {
  const response = await panelJsonCall(harness, "GET", `/news${query}`, { token });
  expect(response.status).toBe(200);
  const raw: unknown = await response.json();
  return panelNewsListSchema.parse(raw);
}

it("lists drafts with filters, ordering and pagination", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await draftsOf(harness, token);

  expect((await listQuery(harness, token, "")).items.map((row) => row.slug)).toEqual([
    "salon-maturzystow",
    "otwarcie-warsztatow",
    "wynajem-sali",
  ]);
  expect((await listQuery(harness, token, "?status=published")).items).toEqual([]);
  expect(
    (await listQuery(harness, token, "?category=Wynajem")).items.map((row) => row.slug),
  ).toEqual(["wynajem-sali"]);
  expect((await listQuery(harness, token, "?year=2025")).items.map((row) => row.date)).toEqual([
    "2025-05-05",
  ]);
  expect(
    (await listQuery(harness, token, "?page=2&pageSize=2")).items.map((row) => row.slug),
  ).toEqual(["wynajem-sali"]);
});

it("clamps query bounds before querying the database", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await draftsOf(harness, token);

  expect(await listQuery(harness, token, "?page=0&pageSize=1000")).toMatchObject({
    page: 1,
    pageSize: 50,
    total: 3,
  });
  expect(await listQuery(harness, token, "?page=20000")).toMatchObject({ page: 10000 });
  expect(await listQuery(harness, token, "?pageSize=0")).toMatchObject({ pageSize: 1 });
});

it("rejects unknown query values", async () => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  await expectProblem(await panelJsonCall(harness, "GET", "/news?status=old", { token }), 422);
  await expectProblem(await panelJsonCall(harness, "GET", "/news?year=20x6", { token }), 422);
  await expectProblem(await panelJsonCall(harness, "GET", "/news?category=", { token }), 422);
});

it("publishes and unpublished drafts through the patch route", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await draftsOf(harness, token);

  expect(
    (
      await panelJsonCall(harness, "PATCH", "/news/2026/salon-maturzystow", {
        token,
        body: newsStatusMutation("publish"),
      })
    ).status,
  ).toBe(200);
  expect(
    (await listQuery(harness, token, "?status=published")).items.map((row) => row.slug),
  ).toEqual(["salon-maturzystow"]);

  expect(
    (
      await panelJsonCall(harness, "PATCH", "/news/2026/salon-maturzystow", {
        token,
        body: newsStatusMutation("unpublish"),
      })
    ).status,
  ).toBe(200);
  expect((await listQuery(harness, token, "?status=published")).items).toEqual([]);

  const publishes = await panelAudit(harness.env).list(10);
  expect(publishes.map((row) => row.action)).toEqual([
    "news.unpublish",
    "news.publish",
    "news.create",
    "news.create",
    "news.create",
  ]);

  await expectProblem(
    await panelJsonCall(harness, "PATCH", "/news/2026/brak", {
      token,
      body: newsStatusMutation("publish"),
    }),
    404,
  );
});

it("rejects patch payloads that are not status changes", async () => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await draftsOf(harness, token);

  await expectProblem(
    await panelJsonCall(harness, "PATCH", "/news/2026/salon-maturzystow", {
      token,
      body: { mutation: { action: "publish" } },
    }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "PATCH", "/news/2026/salon-maturzystow", {
      token,
      body: { entity: "news", mutation: { action: "save", item: SALON } },
    }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "PATCH", "/news/2026/salon-maturzystow", {
      token,
      body: { entity: "pages", action: "save" },
    }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "PATCH", "/news/2026/salon-maturzystow", { token, body: {} }),
    422,
  );
});
