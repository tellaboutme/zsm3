import { panelAdminShortLinksListSchema } from "@zsm3/contracts/panel";
import { describe, it } from "vitest";

import { ADMIN, as, LEFT, OFFICE_STAFF, setup, TEACHER } from "./panel-short-link-admin-support.ts";
import { expectProblem, panelJsonCall } from "./panel-support.ts";

describe("administrator view of every active short link", () => {
  it("lists active links of all staff with no destination or password material", async ({
    expect,
  }) => {
    const harness = await setup();
    const response = await panelJsonCall(harness, "GET", "/short-links/all", {
      token: await as(harness, ADMIN),
    });
    const raw: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const summary = panelAdminShortLinksListSchema
      .parse(raw)
      .items.map(({ code, owner, kind, passwordProtected }) => ({
        code,
        owner,
        kind,
        passwordProtected,
      }))
      .toSorted((left, right) => left.code.localeCompare(right.code));
    expect(summary).toEqual([
      { code: "k7mq4ra", owner: LEFT, kind: "url", passwordProtected: true },
      { code: "k7mq4rb", owner: TEACHER, kind: "url", passwordProtected: false },
      { code: "k7mq4re", owner: LEFT, kind: "file", passwordProtected: false },
    ]);
    expect(JSON.stringify(raw)).not.toMatch(/example\.org|salt|hash|object|"key"|s\//u);
  });

  it("pages through active links with the author cursor", async ({ expect }) => {
    const harness = await setup();
    const token = await as(harness, ADMIN);
    const pages: { codes: string[]; last: boolean }[] = [];
    let query = "limit=1";
    for (let page = 0; page < 4; page += 1) {
      const list = panelAdminShortLinksListSchema.parse(
        await (await panelJsonCall(harness, "GET", `/short-links/all?${query}`, { token })).json(),
      );
      pages.push({ codes: list.items.map((item) => item.code), last: list.nextCursor === null });
      if (list.nextCursor === null) {
        break;
      }
      const { createdAt, code } = list.nextCursor;
      query = `limit=1&beforeCreatedAt=${encodeURIComponent(createdAt)}&beforeCode=${code}`;
    }

    expect(pages.map((page) => [page.codes.length, page.last])).toEqual([
      [1, false],
      [1, false],
      [1, true],
    ]);
    expect(pages.flatMap((page) => page.codes).toSorted()).toEqual([
      "k7mq4ra",
      "k7mq4rb",
      "k7mq4re",
    ]);
    await expectProblem(
      await panelJsonCall(harness, "GET", "/short-links/all?limit=0", { token }),
      422,
    );
  });

  it("is refused to every role but admin and to forged identities", async () => {
    const harness = await setup();
    for (const email of [TEACHER, OFFICE_STAFF]) {
      const token = await as(harness, email);
      await expectProblem(await panelJsonCall(harness, "GET", "/short-links/all", { token }), 403);
      await expectProblem(
        await panelJsonCall(harness, "DELETE", "/short-links/all/k7mq4ra", { token, body: {} }),
        403,
      );
    }
    await expectProblem(
      await panelJsonCall(harness, "DELETE", "/short-links/all/k7mq4ra", {
        token: "forged",
        body: {},
      }),
      401,
    );
    await expectProblem(
      await panelJsonCall(harness, "DELETE", "/short-links/all/k7mq4ra", {
        token: await as(harness, LEFT),
        body: {},
      }),
      403,
    );
  });
});
