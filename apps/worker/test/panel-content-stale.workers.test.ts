import { panelNewsViewSchema, panelPageViewSchema } from "@zsm3/contracts/panel";
import { describe, it } from "vitest";

import {
  article,
  contentOnWorkerd,
  interleaved,
  newsState,
  page,
  pageState,
} from "./panel-content-workers-support.ts";

describe("stale news writes on D1", () => {
  it("refuses an edit read before an unpublish that commits ahead of its batch", async ({
    expect,
  }) => {
    const { send, pegs } = await contentOnWorkerd();
    const news = article("salon-przeplot");
    await send("POST", "/news", news.edit("Lead.", null));
    await send("PATCH", news.api, news.flip("publish", 0));
    const before = await newsState("salon-przeplot");
    pegs.length = 0;
    const unpublishedByB: number[] = [];

    const editByA = await send(
      "PUT",
      news.api,
      news.edit("Poprawka A.", 1),
      interleaved(async () => {
        unpublishedByB.push((await send("PATCH", news.api, news.flip("unpublish", 1))).status);
      }),
    );

    expect({
      b: unpublishedByB,
      a: editByA.status,
      after: await newsState("salon-przeplot"),
      pegs,
    }).toEqual({
      b: [200],
      a: 409,
      after: {
        ...before,
        status: "draft",
        audits: before.audits + 1,
        revisions: before.revisions + 1,
      },
      pegs: [[news.address]],
    });
  });

  it("refuses a stale edit after the article was withdrawn", async ({ expect }) => {
    const { send, pegs } = await contentOnWorkerd();
    const news = article("salon-wycofany");
    await send("POST", "/news", news.edit("Lead.", null));
    await send("PATCH", news.api, news.flip("publish", 0));
    await send("PATCH", news.api, news.flip("unpublish", 1));
    const before = await newsState("salon-wycofany");
    pegs.length = 0;

    const stale = await send("PUT", news.api, news.edit("Poprawka A.", 1));

    expect({ status: stale.status, after: await newsState("salon-wycofany"), pegs }).toEqual({
      status: 409,
      after: before,
      pegs: [],
    });
  });

  it("refuses a stale edit when the status has returned to what the editor saw", async ({
    expect,
  }) => {
    const { send } = await contentOnWorkerd();
    const news = article("salon-aba");
    await send("POST", "/news", news.edit("Lead.", null));
    await send("PATCH", news.api, news.flip("publish", 0));
    await send("PATCH", news.api, news.flip("unpublish", 1));
    await send("PATCH", news.api, news.flip("publish", 2));
    const before = await newsState("salon-aba");

    const stale = await send("PUT", news.api, news.edit("Poprawka A.", 1));

    expect(stale.status).toBe(409);
    expect(before.status).toBe("published");
    expect(await newsState("salon-aba")).toEqual(before);
  });

  it("lets exactly one of two concurrent edits from one revision commit", async ({ expect }) => {
    const { send, pegs } = await contentOnWorkerd();
    const news = article("salon-rownolegly");
    await send("POST", "/news", news.edit("Lead.", null));
    await send("PATCH", news.api, news.flip("publish", 0));
    pegs.length = 0;

    const results = await Promise.all([
      send("PUT", news.api, news.edit("Poprawka A.", 1)),
      send("PUT", news.api, news.edit("Poprawka B.", 1)),
    ]);

    expect(results.map((result) => result.status).toSorted((a, b) => a - b)).toEqual([200, 409]);
    expect((await newsState("salon-rownolegly")).revisions).toBe(2);
    expect(pegs).toEqual([[news.address]]);
  });

  it("accepts the retry once the editor reloads the current revision", async ({ expect }) => {
    const { send } = await contentOnWorkerd();
    const news = article("salon-ponowny");
    await send("POST", "/news", news.edit("Lead.", null));
    await send("PATCH", news.api, news.flip("publish", 0));
    await send("PUT", news.api, news.edit("Poprawka B.", 1));
    expect((await send("PUT", news.api, news.edit("Poprawka A.", 1))).status).toBe(409);

    const reloaded = panelNewsViewSchema.parse(await (await send("GET", news.api)).json());
    const retried = await send("PUT", news.api, news.edit("Poprawka A.", reloaded.revision));

    expect(reloaded.revision).toBe(2);
    expect(await retried.json()).toEqual({ ok: true, revision: 3 });
  });

  it("refuses an edit without an expected revision", async ({ expect }) => {
    const { send } = await contentOnWorkerd();
    const news = article("salon-bez-wersji");
    await send("POST", "/news", news.edit("Lead.", null));

    const missing = await send("PUT", news.api, news.edit("Poprawka.", null));

    expect(missing.status).toBe(422);
  });
});

describe("stale page writes on D1", () => {
  it("refuses an edit read before a withdrawal that commits ahead of its batch", async ({
    expect,
  }) => {
    const { send, pegs } = await contentOnWorkerd();
    const cooperation = page("/szkola/wspolpraca");
    await send("PUT", cooperation.api, cooperation.save("published", "Wspolpraca", null));
    pegs.length = 0;
    const withdrawnByB: number[] = [];

    const editByA = await send(
      "PUT",
      cooperation.api,
      cooperation.save("published", "Wspolpraca z firmami", 0),
      interleaved(async () => {
        withdrawnByB.push(
          (await send("PUT", cooperation.api, cooperation.save("draft", "Wspolpraca", 0))).status,
        );
      }),
    );

    expect({
      b: withdrawnByB,
      a: editByA.status,
      after: await pageState("/szkola/wspolpraca"),
      pegs,
    }).toEqual({
      b: [200],
      a: 409,
      after: { status: "draft", title: "Wspolpraca", revisions: 1 },
      pegs: [["/szkola/wspolpraca"]],
    });
    const view = panelPageViewSchema.parse(await (await send("GET", cooperation.api)).json());
    expect(view.revision).toBe(1);
  });

  it("refuses to create a page another editor has just created", async ({ expect }) => {
    const { send, pegs } = await contentOnWorkerd();
    const fresh = page("/szkola/nowa");
    const createdByB: number[] = [];

    const createdByA = await send(
      "PUT",
      fresh.api,
      fresh.save("published", "Strona A", null),
      interleaved(async () => {
        createdByB.push(
          (await send("PUT", fresh.api, fresh.save("draft", "Strona B", null))).status,
        );
      }),
    );

    expect({
      b: createdByB,
      a: createdByA.status,
      after: await pageState("/szkola/nowa"),
      pegs,
    }).toEqual({
      b: [200],
      a: 409,
      after: { status: "draft", title: "Strona B", revisions: 0 },
      pegs: [],
    });
    expect((await send("PUT", fresh.api, fresh.save("draft", "Strona A", null))).status).toBe(409);
  });

  it("refuses to restore over a newer version", async ({ expect }) => {
    const { send } = await contentOnWorkerd();
    const history = page("/szkola/historia");
    await send("PUT", history.api, history.save("published", "Pierwsza", null));
    await send("PUT", history.api, history.save("published", "Druga", 0));
    await send("PUT", history.api, history.save("draft", "Druga", 1));

    const restored = await send("POST", "/revisions/restore", {
      entity: "revisions",
      target: "pages",
      id: "/szkola/historia",
      revision: 1,
      expectedRevision: 1,
    });

    expect(restored.status).toBe(409);
    expect(await pageState("/szkola/historia")).toEqual({
      status: "draft",
      title: "Druga",
      revisions: 2,
    });
  });
});
