import { describe, it } from "vitest";

import {
  panelAdminShortLinkItemSchema,
  panelAdminShortLinksListSchema,
  panelShortLinksQuerySchema,
} from "../src/panel.ts";
import { shortCodeSchema } from "../src/short-links.ts";

const ITEM = {
  code: "k7mq4ra",
  owner: "byly-nauczyciel@zsm3.test",
  kind: "file",
  createdAt: "2026-10-01T08:00:00.000Z",
  expiresAt: "2027-08-31T22:00:00.000Z",
  passwordProtected: true,
};

describe("administrator short link listing", () => {
  it("carries the author, kind, dates and password flag and nothing else", ({ expect }) => {
    expect(panelAdminShortLinkItemSchema.parse(ITEM)).toEqual(ITEM);
    expect(panelAdminShortLinkItemSchema.parse({ ...ITEM, kind: "url" }).kind).toBe("url");
    expect(panelAdminShortLinkItemSchema.safeParse({ ...ITEM, kind: "" }).success).toBe(false);
    expect(panelAdminShortLinkItemSchema.safeParse({ ...ITEM, target: "x" }).success).toBe(false);
    expect(panelAdminShortLinkItemSchema.safeParse({ ...ITEM, code: "zly" }).success).toBe(false);
  });

  it("bounds the author address", ({ expect }) => {
    expect(panelAdminShortLinkItemSchema.safeParse({ ...ITEM, owner: "a" }).success).toBe(true);
    expect(
      panelAdminShortLinkItemSchema.safeParse({ ...ITEM, owner: "a".repeat(320) }).success,
    ).toBe(true);
    expect(panelAdminShortLinkItemSchema.safeParse({ ...ITEM, owner: "" }).success).toBe(false);
    expect(
      panelAdminShortLinkItemSchema.safeParse({ ...ITEM, owner: "a".repeat(321) }).success,
    ).toBe(false);
  });

  it("holds at most 200 items and a nullable cursor", ({ expect }) => {
    const cursor = { createdAt: ITEM.createdAt, code: ITEM.code };
    expect(panelAdminShortLinksListSchema.parse({ items: [ITEM], nextCursor: cursor })).toEqual({
      items: [ITEM],
      nextCursor: cursor,
    });
    expect(panelAdminShortLinksListSchema.safeParse({ items: [], nextCursor: null }).success).toBe(
      true,
    );
    expect(
      panelAdminShortLinksListSchema.safeParse({
        items: Array.from({ length: 201 }, () => ITEM),
        nextCursor: null,
      }).success,
    ).toBe(false);
  });
});

describe("short codes and cursors", () => {
  it("anchors a code at its first character", ({ expect }) => {
    expect(shortCodeSchema.safeParse("Ak7mq4r").success).toBe(false);
    expect(shortCodeSchema.safeParse("k7mq4ra").success).toBe(true);
  });

  it("explains a half-given cursor", ({ expect }) => {
    const result = panelShortLinksQuerySchema.safeParse({ beforeCode: "k7mq4ra" });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Cursor fields must be provided together",
    ]);
  });
});
