import { panelNewsViewSchema, panelPageViewSchema } from "@zsm3/contracts/panel";
import { it } from "vitest";

import { indexNowSession, publishedSalon, SALON_API_PATH } from "./indexnow-spy.ts";
import {
  newsStatusMutation,
  pageSaveMutation,
  restoreMutation,
  samplePage,
} from "./panel-fixtures.ts";
import { panelSpyHarness, SPY_ADMIN, spyToken } from "./panel-spy.ts";
import { panelJsonCall, seedStaff } from "./panel-support.ts";
import type { SqlDatabase } from "../../src/storage/database.ts";

const CONTACT = samplePage("/kontakt", "Kontakt");

it("shows the revision a later write has to expect", async ({ expect }) => {
  const session = await indexNowSession();
  await publishedSalon(session);
  const { harness, token } = session;
  await panelJsonCall(harness, "PUT", "/pages/kontakt", {
    token,
    body: pageSaveMutation(CONTACT, "draft", null),
  });
  const saved = await panelJsonCall(harness, "PUT", "/pages/kontakt", {
    token,
    body: pageSaveMutation({ ...CONTACT, title: "Kontakt ZSM3" }, "draft", 0),
  });

  const news = panelNewsViewSchema.parse(
    await (await panelJsonCall(harness, "GET", SALON_API_PATH, { token })).json(),
  );
  const page = panelPageViewSchema.parse(
    await (await panelJsonCall(harness, "GET", "/pages/kontakt", { token })).json(),
  );

  expect(await saved.json()).toEqual({ ok: true, revision: 1 });
  expect([news.revision, page.revision]).toEqual([1, 1]);
});

it("reports a stale publication as a conflict before an unchanged status", async ({ expect }) => {
  const session = await indexNowSession();
  await publishedSalon(session);
  await panelJsonCall(session.harness, "PATCH", SALON_API_PATH, {
    token: session.token,
    body: newsStatusMutation("unpublish", 1),
  });
  await panelJsonCall(session.harness, "PATCH", SALON_API_PATH, {
    token: session.token,
    body: newsStatusMutation("publish", 2),
  });

  const stale = await panelJsonCall(session.harness, "PATCH", SALON_API_PATH, {
    token: session.token,
    body: newsStatusMutation("publish", 1),
  });

  expect(stale.status).toBe(409);
});

it("reports a stale restore as a conflict before a missing version", async ({ expect }) => {
  const session = await indexNowSession();
  await panelJsonCall(session.harness, "PUT", "/pages/kontakt", {
    token: session.token,
    body: pageSaveMutation(CONTACT, "draft", null),
  });
  await panelJsonCall(session.harness, "PUT", "/pages/kontakt", {
    token: session.token,
    body: pageSaveMutation({ ...CONTACT, title: "Kontakt ZSM3" }, "draft", 0),
  });

  const stale = await panelJsonCall(session.harness, "POST", "/revisions/restore", {
    token: session.token,
    body: restoreMutation("pages", "/kontakt", 9, 0),
  });

  expect(stale.status).toBe(409);
});

it("refuses a page another editor creates while the batch is pending", async ({ expect }) => {
  const session = await indexNowSession();
  const { env } = session.harness;
  const memory = env.DB;
  const createdByB: number[] = [];
  let pending = true;
  const DB: SqlDatabase = {
    prepare: (query) => memory.prepare(query),
    batch: async (statements) => {
      if (pending) {
        pending = false;
        const created = await panelJsonCall(session.harness, "PUT", "/pages/kontakt", {
          token: session.token,
          body: pageSaveMutation({ ...CONTACT, title: "Kontakt B" }, "draft", null),
        });
        createdByB.push(created.status);
      }
      return memory.batch(statements);
    },
  };

  const raced = await panelJsonCall(
    { ...session.harness, env: { ...env, DB } },
    "PUT",
    "/pages/kontakt",
    { token: session.token, body: pageSaveMutation(CONTACT, "published", null) },
  );

  expect({ a: raced.status, b: createdByB }).toEqual({ a: 409, b: [200] });
  expect(session.pegs).toEqual([]);
});

it("does not touch the database for a creation that names an existing page", async ({ expect }) => {
  const harness = await panelSpyHarness();
  await seedStaff(harness.env, [SPY_ADMIN]);
  const token = await spyToken(harness);
  await panelJsonCall(harness, "PUT", "/pages/kontakt", {
    token,
    body: pageSaveMutation(CONTACT, "draft", null),
  });
  const batches = harness.batches.length;

  const recreated = await panelJsonCall(harness, "PUT", "/pages/kontakt", {
    token,
    body: pageSaveMutation(CONTACT, "published", null),
  });

  expect(recreated.status).toBe(409);
  expect(harness.batches).toHaveLength(batches);
});
