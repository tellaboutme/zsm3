import { panelNewsListSchema, panelNewsViewSchema } from "@zsm3/contracts/panel";
import { panelSavedSchema } from "@zsm3/contracts/revisions";
import { it } from "vitest";
import { z } from "zod";

import { newsSaveMutation, newsStatusMutation, sampleNews, staffMember } from "./panel-fixtures.ts";
import {
  expectProblem,
  panelAudit,
  panelHarness,
  panelJsonCall,
  panelRawCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";
import type { IndexNowEndpoint } from "../../src/services/indexnow.ts";

const ADMIN = staffMember("admin@zsm3.test", "admin", true);

function indexNowSpy(pegs: string[][]): IndexNowEndpoint {
  return {
    submit: async (urls: readonly string[]): Promise<boolean> => {
      pegs.push([...urls]);
      return Promise.resolve(true);
    },
  };
}

function fieldsOf(json: string): readonly string[] {
  const fields: unknown = JSON.parse(json);
  return z.object({ fields: z.array(z.string()) }).parse(fields).fields;
}

it("creates a draft and writes the audit trail", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const created = await panelJsonCall(harness, "POST", "/news", {
    token,
    body: newsSaveMutation(sampleNews("salon-maturzystow", "Salon Maturzystow")),
  });
  expect(created.status).toBe(201);
  const createdOk: unknown = await created.json();
  expect(panelSavedSchema.parse(createdOk)).toEqual({ ok: true, revision: 0 });

  const list = await panelJsonCall(harness, "GET", "/news", { token });
  const rawPage: unknown = await list.json();
  const page = panelNewsListSchema.parse(rawPage);
  expect(page).toMatchObject({ total: 1, page: 1, pageSize: 20 });
  expect(page.items[0]?.slug).toBe("salon-maturzystow");
  expect(page.items[0]?.status).toBe("draft");

  const records = await panelAudit(harness.env).byEntity("news", "2026/salon-maturzystow", 10);
  const record = records[0];
  if (record === undefined) {
    throw new Error("fixture");
  }
  expect(record.action).toBe("news.create");
  expect(record.actorEmail).toBe(ADMIN.email);
  expect(fieldsOf(record.details)).toEqual(["slug", "date", "category", "title", "lead", "body"]);
});

it("refuses a duplicate slug", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  const body = newsSaveMutation(sampleNews("salon-maturzystow", "Salon Maturzystow"));

  expect((await panelJsonCall(harness, "POST", "/news", { token, body })).status).toBe(201);
  await expectProblem(await panelJsonCall(harness, "POST", "/news", { token, body }), 422);
});

it("rejects malformed and foreign entity payloads", async () => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  const headers = { authorization: `Bearer ${token}`, origin: "https://panel.zsm3.test" };

  await expectProblem(
    await panelRawCall(harness, "POST", "/news", {
      headers: { ...headers, "content-type": "application/json" },
      body: "{abc",
    }),
    422,
  );
  await expectProblem(
    await panelRawCall(harness, "POST", "/news", {
      headers: { ...headers, "content-type": "text/plain" },
      body: "{}",
    }),
    403,
  );
  await expectProblem(
    await panelJsonCall(harness, "POST", "/news", {
      token,
      body: { entity: "pages", action: "save" },
    }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "POST", "/news", {
      token,
      body: { entity: "news", mutation: { action: "publish" } },
    }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "POST", "/news", {
      token,
      body: newsSaveMutation(sampleNews("ZleNazewnictwo", "Salon")),
    }),
    422,
  );
});

it("shows a single draft and misses unknown slugs", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await panelJsonCall(harness, "POST", "/news", {
    token,
    body: newsSaveMutation(sampleNews("salon-maturzystow", "Salon Maturzystow")),
  });

  const shown = await panelJsonCall(harness, "GET", "/news/2026/salon-maturzystow", { token });
  const rawView: unknown = await shown.json();
  const view = panelNewsViewSchema.parse(rawView);
  expect(view.item).toEqual({
    ...sampleNews("salon-maturzystow", "Salon Maturzystow"),
    status: "draft",
  });
  await expectProblem(await panelJsonCall(harness, "GET", "/news/2026/brak", { token }), 404);
  await expectProblem(await panelJsonCall(harness, "GET", "/news/2026/BRak", { token }), 422);
  await expectProblem(await panelJsonCall(harness, "GET", "/news/202x/salon", { token }), 422);
});

it("notifies search engines once a draft gets published", async ({ expect }) => {
  const pegs: string[][] = [];
  const harness = await panelHarness({ indexnow: indexNowSpy(pegs) });
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  await panelJsonCall(harness, "POST", "/news", {
    token,
    body: newsSaveMutation(sampleNews("salon-maturzystow", "Salon Maturzystow")),
  });

  const published = await panelJsonCall(harness, "PATCH", "/news/2026/salon-maturzystow", {
    token,
    body: newsStatusMutation("publish"),
  });
  expect(published.status).toBe(200);
  expect(pegs).toEqual([["/aktualnosci/2026/salon-maturzystow"]]);
});

it("notifies again when the article is unpublished", async ({ expect }) => {
  const pegs: string[][] = [];
  const harness = await panelHarness({ indexnow: indexNowSpy(pegs) });
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await panelJsonCall(harness, "POST", "/news", {
    token,
    body: newsSaveMutation(sampleNews("salon-maturzystow", "Salon Maturzystow")),
  });

  const published = await panelJsonCall(harness, "PATCH", "/news/2026/salon-maturzystow", {
    token,
    body: newsStatusMutation("publish"),
  });
  expect(published.status).toBe(200);
  expect(pegs).toHaveLength(1);

  const unpublished = await panelJsonCall(harness, "PATCH", "/news/2026/salon-maturzystow", {
    token,
    body: newsStatusMutation("unpublish", 1),
  });
  expect(unpublished.status).toBe(200);
  expect(pegs).toEqual([
    ["/aktualnosci/2026/salon-maturzystow"],
    ["/aktualnosci/2026/salon-maturzystow"],
  ]);
});
