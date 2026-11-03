import { it } from "vitest";

import {
  indexNowSession,
  publishedSalon,
  SALON,
  SALON_API_PATH,
  type IndexNowSession,
} from "./indexnow-spy.ts";
import {
  newsSaveMutation,
  newsStatusMutation,
  pageSaveMutation,
  restoreMutation,
  sampleNews,
  samplePage,
} from "./panel-fixtures.ts";
import { panelAudit, panelJsonRequest } from "./panel-support.ts";
import type { SqlDatabase } from "../../src/storage/database.ts";

const CONTACT = samplePage("/kontakt", "Kontakt");

function interleaved(session: IndexNowSession, before: () => Promise<unknown>): Env {
  const { env } = session.harness;
  const memory = env.DB;
  let pending = true;
  const DB: SqlDatabase = {
    prepare: (query) => memory.prepare(query),
    batch: async (statements) => {
      if (pending) {
        pending = false;
        await before();
      }
      return memory.batch(statements);
    },
  };
  return { ...env, DB };
}

interface Call {
  readonly method: "PUT" | "POST" | "PATCH";
  readonly path: string;
  readonly body: unknown;
}

async function call(
  session: IndexNowSession,
  { method, path, body }: Call,
  on: Env = session.harness.env,
): Promise<number> {
  const request = panelJsonRequest(method, path, session.token, body);
  return (await session.harness.app.fetch(request, on)).status;
}

const putPage = (body: unknown): Call => ({ method: "PUT", path: "/pages/kontakt", body });

it("refuses a page save whose expected revision is not the current one", async ({ expect }) => {
  const session = await indexNowSession();
  await call(session, putPage(pageSaveMutation(CONTACT, "published", null)));
  await call(session, putPage(pageSaveMutation(CONTACT, "draft", 0)));
  session.pegs.length = 0;
  const audits = (await panelAudit(session.harness.env).list(10)).length;

  const stale = pageSaveMutation({ ...CONTACT, title: "Stary kontakt" }, "published", 0);
  const recreated = pageSaveMutation(CONTACT, "published", null);
  const unknown = pageSaveMutation(samplePage("/brak", "Brak"), "published", 3);

  expect(await call(session, putPage(stale))).toBe(409);
  expect(await call(session, putPage(recreated))).toBe(409);
  expect(await call(session, { method: "PUT", path: "/pages/brak", body: unknown })).toBe(409);
  expect((await panelAudit(session.harness.env).list(10)).length).toBe(audits);
  expect(session.pegs).toEqual([]);
});

it("refuses an article created by another editor in the meantime", async ({ expect }) => {
  const session = await indexNowSession();
  const first = newsSaveMutation(sampleNews("salon", "Salon A"));
  const second = newsSaveMutation(sampleNews("salon", "Salon B"));
  const createdByB: number[] = [];

  const createdByA = await call(
    session,
    { method: "POST", path: "/news", body: first },
    interleaved(session, async () => {
      createdByB.push(await call(session, { method: "POST", path: "/news", body: second }));
    }),
  );

  expect({ a: createdByA, b: createdByB }).toEqual({ a: 409, b: [201] });
  const audits = await panelAudit(session.harness.env).byEntity("news", "2026/salon", 10);
  expect(audits.map((row) => row.action)).toEqual(["news.create"]);
});

it("refuses a restore when another change commits ahead of its batch", async ({ expect }) => {
  const session = await indexNowSession();
  await call(session, putPage(pageSaveMutation(CONTACT, "published", null)));
  const renamed = { ...CONTACT, title: "Kontakt i dojazd" };
  await call(session, putPage(pageSaveMutation(renamed, "published", 0)));
  session.pegs.length = 0;
  const withdrawnByB: number[] = [];

  const restoredByA = await call(
    session,
    {
      method: "POST",
      path: "/revisions/restore",
      body: restoreMutation("pages", "/kontakt", 1, 1),
    },
    interleaved(session, async () => {
      withdrawnByB.push(await call(session, putPage(pageSaveMutation(CONTACT, "draft", 1))));
    }),
  );

  expect({ a: restoredByA, b: withdrawnByB }).toEqual({ a: 409, b: [200] });
  expect(session.pegs).toEqual([["/kontakt"]]);
  const latest = await panelAudit(session.harness.env).byEntity("pages", "/kontakt", 1);
  expect(latest.map((row) => row.action)).toEqual(["pages.save"]);
});

it("refuses an article edit when an unpublish commits ahead of its batch", async ({ expect }) => {
  const session = await indexNowSession();
  await publishedSalon(session);
  const unpublishedByB: number[] = [];

  const editedByA = await call(
    session,
    {
      method: "PUT",
      path: SALON_API_PATH,
      body: newsSaveMutation({ ...SALON, lead: "Poprawka A." }, 1),
    },
    interleaved(session, async () => {
      const response = await session.harness.app.fetch(
        panelJsonRequest(
          "PATCH",
          SALON_API_PATH,
          session.token,
          newsStatusMutation("unpublish", 1),
        ),
        session.harness.env,
      );
      unpublishedByB.push(response.status);
    }),
  );

  expect({ a: editedByA, b: unpublishedByB }).toEqual({ a: 409, b: [200] });
  expect(session.pegs).toEqual([["/aktualnosci/2026/salon-maturzystow"]]);
});
