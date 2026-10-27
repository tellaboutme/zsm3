import { panelNewsListSchema, panelNewsViewSchema, panelOkSchema } from "@zsm3/contracts/panel";
import { it } from "vitest";
import { z } from "zod";

import { newsSaveMutation, sampleNews, staffMember } from "./panel-fixtures.ts";
import {
  expectProblem,
  panelAudit,
  panelHarness,
  panelJsonCall,
  panelRawCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";

const ADMIN = staffMember("admin@zsm3.test", "admin", true);

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
  expect(panelOkSchema.parse(createdOk)).toEqual({ ok: true });

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
