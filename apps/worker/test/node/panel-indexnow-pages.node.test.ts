import type { PublicationStatus } from "@zsm3/contracts/content";
import { it } from "vitest";

import { indexNowSession, type IndexNowSession } from "./indexnow-spy.ts";
import { pageSaveMutation, samplePage } from "./panel-fixtures.ts";
import { panelJsonCall } from "./panel-support.ts";
import { liveStore } from "../../src/storage/database.ts";
import { pagesRepo } from "../../src/storage/pages-repo.ts";
import { sitemapRepo } from "../../src/storage/sitemap-repo.ts";

const COOPERATION = samplePage("/szkola/wspolpraca", "Wspolpraca");

async function save(
  session: IndexNowSession,
  title: string,
  status: PublicationStatus,
): Promise<number> {
  const response = await panelJsonCall(session.harness, "PUT", "/pages/szkola/wspolpraca", {
    token: session.token,
    body: pageSaveMutation({ ...COOPERATION, title }, status),
  });
  return response.status;
}

it("announces a page published on its first save", async ({ expect }) => {
  const session = await indexNowSession();

  const saved = await panelJsonCall(session.harness, "PUT", "/pages/szkola/wspolpraca", {
    token: session.token,
    body: pageSaveMutation(COOPERATION, "published"),
  });

  expect(await saved.json()).toEqual({ ok: true });
  expect(session.pegs).toEqual([["/szkola/wspolpraca"]]);
});

it("keeps quiet while a page is only saved as a draft", async ({ expect }) => {
  const session = await indexNowSession();

  expect(await save(session, "Wspolpraca", "draft")).toBe(200);
  expect(await save(session, "Wspolpraca z firmami", "draft")).toBe(200);
  expect(session.pegs).toEqual([]);
});

it("announces a draft page once it becomes public", async ({ expect }) => {
  const session = await indexNowSession();
  await save(session, "Wspolpraca", "draft");

  expect(await save(session, "Wspolpraca", "published")).toBe(200);
  expect(session.pegs).toEqual([["/szkola/wspolpraca"]]);
});

it("announces edits of a public page and skips saves without changes", async ({ expect }) => {
  const session = await indexNowSession();
  await save(session, "Wspolpraca", "published");
  session.pegs.length = 0;

  await save(session, "Wspolpraca", "published");
  expect(session.pegs).toEqual([]);

  await save(session, "Wspolpraca z firmami", "published");
  expect(session.pegs).toEqual([["/szkola/wspolpraca"]]);
});

it("announces the previous address when a public page is withdrawn", async ({ expect }) => {
  const session = await indexNowSession();
  await save(session, "Wspolpraca", "published");
  session.pegs.length = 0;

  expect(await save(session, "Wspolpraca", "draft")).toBe(200);
  expect(await save(session, "Wspolpraca", "draft")).toBe(200);

  expect(session.pegs).toEqual([["/szkola/wspolpraca"]]);
  const store = liveStore(session.harness.env.DB);
  await expect(pagesRepo(store).find("/szkola/wspolpraca")).resolves.toBeUndefined();
  await expect(sitemapRepo(store).published()).resolves.toEqual([]);
});
