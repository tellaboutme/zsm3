import { newsPath } from "@zsm3/contracts/content";
import { it } from "vitest";

import { indexNowSession, publishedSalon, SALON, SALON_API_PATH } from "./indexnow-spy.ts";
import { newsSaveMutation, newsStatusMutation, sampleNews } from "./panel-fixtures.ts";
import { expectProblem, panelAudit, panelJsonCall } from "./panel-support.ts";
import { liveStore } from "../../src/storage/database.ts";
import { sitemapRepo } from "../../src/storage/sitemap-repo.ts";

const CANONICAL = "/aktualnosci/2026/salon-maturzystow";

it("announces an edit of a published article under its canonical address", async ({ expect }) => {
  const session = await indexNowSession();
  await publishedSalon(session);

  const edited = await panelJsonCall(session.harness, "PUT", SALON_API_PATH, {
    token: session.token,
    body: newsSaveMutation({ ...SALON, lead: "Nowy lead relacji." }, 1),
  });

  expect(edited.status).toBe(200);
  expect(await edited.json()).toEqual({ ok: true, revision: 2 });
  expect(session.pegs).toEqual([[CANONICAL]]);
});

it("audits a publication as a status change only", async ({ expect }) => {
  const session = await indexNowSession();
  await publishedSalon(session);

  const [entry] = await panelAudit(session.harness.env).byEntity(
    "news",
    "2026/salon-maturzystow",
    1,
  );

  expect(entry?.action).toBe("news.publish");
  expect(JSON.parse(entry?.details ?? "{}")).toEqual({ fields: ["status"] });
});

it("announces the same address the sitemap lists", async ({ expect }) => {
  const session = await indexNowSession();
  await publishedSalon(session);
  await panelJsonCall(session.harness, "PUT", SALON_API_PATH, {
    token: session.token,
    body: newsSaveMutation({ ...SALON, title: "Salon Maturzystow 2026" }, 1),
  });

  const entries = await sitemapRepo(liveStore(session.harness.env.DB)).published();

  expect(entries.map((entry) => entry.path)).toEqual(session.pegs.flat());
  expect(session.pegs.flat()).toEqual([newsPath(SALON)]);
});

it("keeps quiet when a published article is saved without changes", async ({ expect }) => {
  const session = await indexNowSession();
  await publishedSalon(session);

  const saved = await panelJsonCall(session.harness, "PUT", SALON_API_PATH, {
    token: session.token,
    body: newsSaveMutation(SALON, 1),
  });

  expect(saved.status).toBe(200);
  expect(session.pegs).toEqual([]);
});

it("keeps quiet while a draft is edited", async ({ expect }) => {
  const session = await indexNowSession();
  await panelJsonCall(session.harness, "POST", "/news", {
    token: session.token,
    body: newsSaveMutation(SALON),
  });

  const edited = await panelJsonCall(session.harness, "PUT", SALON_API_PATH, {
    token: session.token,
    body: newsSaveMutation({ ...SALON, title: "Salon Maturzystow 2026" }, 0),
  });

  expect(edited.status).toBe(200);
  expect(session.pegs).toEqual([]);
});

it("keeps quiet when an edit is refused", async ({ expect }) => {
  const session = await indexNowSession();
  await publishedSalon(session);

  const moved = await panelJsonCall(session.harness, "PUT", SALON_API_PATH, {
    token: session.token,
    body: newsSaveMutation(sampleNews("inny-salon", "Salon"), 1),
  });

  await expectProblem(moved, 422);
  expect(session.pegs).toEqual([]);
});

it("announces the withdrawn address once when an article is unpublished", async ({ expect }) => {
  const session = await indexNowSession();
  await publishedSalon(session);

  const unpublished = await panelJsonCall(session.harness, "PATCH", SALON_API_PATH, {
    token: session.token,
    body: newsStatusMutation("unpublish", 1),
  });
  const again = await panelJsonCall(session.harness, "PATCH", SALON_API_PATH, {
    token: session.token,
    body: newsStatusMutation("unpublish", 2),
  });

  expect(unpublished.status).toBe(200);
  await expectProblem(again, 422);
  expect(session.pegs).toEqual([[CANONICAL]]);
  await expect(sitemapRepo(liveStore(session.harness.env.DB)).published()).resolves.toEqual([]);
});

it("does not announce a repeated publication", async ({ expect }) => {
  const session = await indexNowSession();
  await publishedSalon(session);

  const again = await panelJsonCall(session.harness, "PATCH", SALON_API_PATH, {
    token: session.token,
    body: newsStatusMutation("publish", 1),
  });

  await expectProblem(again, 422);
  expect(session.pegs).toEqual([]);
});

it("lets only one of two concurrent edits from the same revision commit", async ({ expect }) => {
  const session = await indexNowSession();
  await publishedSalon(session);

  const edits = await Promise.all(
    ["Pierwsza poprawka.", "Druga poprawka."].map(async (lead) =>
      panelJsonCall(session.harness, "PUT", SALON_API_PATH, {
        token: session.token,
        body: newsSaveMutation({ ...SALON, lead }, 1),
      }),
    ),
  );

  expect(edits.map((edit) => edit.status).toSorted((a, b) => a - b)).toEqual([200, 409]);
  expect(session.pegs).toEqual([[CANONICAL]]);
});
