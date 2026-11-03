import { afterEach, describe, it, vi } from "vitest";

import {
  article,
  committedButLost,
  contentOnWorkerd,
  lostBefore,
  newsState,
  page,
  pageState,
} from "./panel-content-workers-support.ts";

const RECOVERED = JSON.stringify({ event: "panel_write_recovered", errorName: "Error" });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a D1 error reported after the batch committed", () => {
  it("answers success for a published edit and announces it once", async ({ expect }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { send, pegs } = await contentOnWorkerd();
    const news = article("salon-niepewny");
    await send("POST", "/news", news.edit("Lead.", null));
    await send("PATCH", news.api, news.flip("publish", 0));
    const before = await newsState("salon-niepewny");
    pegs.length = 0;

    const edited = await send("PUT", news.api, news.edit("Poprawka.", 1), committedButLost());

    expect({
      status: edited.status,
      body: await edited.json(),
      after: await newsState("salon-niepewny"),
      pegs,
      logs: logged.mock.calls,
    }).toEqual({
      status: 200,
      body: { ok: true, revision: 2 },
      after: {
        status: "published",
        lead: "Poprawka.",
        audits: before.audits + 1,
        revisions: before.revisions + 1,
      },
      pegs: [[news.address]],
      logs: [[RECOVERED]],
    });
  });

  it("answers success for a publication and announces it", async ({ expect }) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { send, pegs } = await contentOnWorkerd();
    const news = article("salon-niepewna-publikacja");
    await send("POST", "/news", news.edit("Lead.", null));

    const published = await send("PATCH", news.api, news.flip("publish", 0), committedButLost());

    expect({
      status: published.status,
      body: await published.json(),
      state: (await newsState("salon-niepewna-publikacja")).status,
      pegs,
    }).toEqual({
      status: 200,
      body: { ok: true, revision: 1 },
      state: "published",
      pegs: [[news.address]],
    });
  });

  it("answers created for a news item whose audit row landed", async ({ expect }) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { send, pegs } = await contentOnWorkerd();
    const news = article("salon-niepewny-nowy");

    const created = await send("POST", "/news", news.edit("Lead.", null), committedButLost());

    expect({
      status: created.status,
      after: await newsState("salon-niepewny-nowy"),
      pegs,
    }).toEqual({
      status: 201,
      after: { status: "draft", lead: "Lead.", audits: 1, revisions: 0 },
      pegs: [],
    });
  });

  it("answers success for a published page creation and announces it", async ({ expect }) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { send, pegs } = await contentOnWorkerd();
    const target = page("/szkola/niepewna");

    const created = await send(
      "PUT",
      target.api,
      target.save("published", "Niepewna", null),
      committedButLost(),
    );

    expect({ status: created.status, after: await pageState("/szkola/niepewna"), pegs }).toEqual({
      status: 200,
      after: { status: "published", title: "Niepewna", revisions: 0 },
      pegs: [["/szkola/niepewna"]],
    });
  });

  it("answers success for a restore and announces the published page", async ({ expect }) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { send, pegs } = await contentOnWorkerd();
    const target = page("/szkola/niepewny-powrot");
    await send("PUT", target.api, target.save("published", "Pierwsza", null));
    await send("PUT", target.api, target.save("published", "Druga", 0));
    pegs.length = 0;

    const restored = await send(
      "POST",
      "/revisions/restore",
      {
        entity: "revisions",
        target: "pages",
        id: "/szkola/niepewny-powrot",
        revision: 1,
        expectedRevision: 1,
      },
      committedButLost(),
    );

    expect({
      status: restored.status,
      after: await pageState("/szkola/niepewny-powrot"),
      pegs,
    }).toEqual({
      status: 200,
      after: { status: "published", title: "Pierwsza", revisions: 2 },
      pegs: [["/szkola/niepewny-powrot"]],
    });
  });
});

describe("a D1 error for a batch that did not commit", () => {
  it("surfaces the error for an edit and changes nothing", async ({ expect }) => {
    const { send, pegs } = await contentOnWorkerd();
    const news = article("salon-utracony");
    await send("POST", "/news", news.edit("Lead.", null));
    await send("PATCH", news.api, news.flip("publish", 0));
    const before = await newsState("salon-utracony");
    pegs.length = 0;

    const edited = await send("PUT", news.api, news.edit("Poprawka.", 1), lostBefore());

    expect({ status: edited.status, after: await newsState("salon-utracony"), pegs }).toEqual({
      status: 500,
      after: before,
      pegs: [],
    });
  });

  it("surfaces the error for a page creation and creates nothing", async ({ expect }) => {
    const { send, pegs } = await contentOnWorkerd();
    const target = page("/szkola/utracona");

    const created = await send(
      "PUT",
      target.api,
      target.save("published", "Utracona", null),
      lostBefore(),
    );

    expect({ status: created.status, after: await pageState("/szkola/utracona"), pegs }).toEqual({
      status: 500,
      after: { status: "missing", title: "", revisions: 0 },
      pegs: [],
    });
  });

  it("reports a conflict when another editor committed meanwhile", async ({ expect }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { send, pegs } = await contentOnWorkerd();
    const news = article("salon-wyprzedzony");
    await send("POST", "/news", news.edit("Lead.", null));
    await send("PATCH", news.api, news.flip("publish", 0));
    const before = await newsState("salon-wyprzedzony");
    pegs.length = 0;
    const unpublishedByB: number[] = [];

    const editByA = await send(
      "PUT",
      news.api,
      news.edit("Poprawka A.", 1),
      lostBefore(async () => {
        unpublishedByB.push((await send("PATCH", news.api, news.flip("unpublish", 1))).status);
      }),
    );

    expect({
      a: editByA.status,
      b: unpublishedByB,
      after: await newsState("salon-wyprzedzony"),
      pegs,
    }).toEqual({
      a: 409,
      b: [200],
      after: {
        ...before,
        status: "draft",
        audits: before.audits + 1,
        revisions: before.revisions + 1,
      },
      pegs: [[news.address]],
    });
    expect(logged.mock.calls).toEqual([]);
  });
});
