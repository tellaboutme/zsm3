import { describe, expect, it } from "vitest";

import {
  panelShortLinkCreatedSchema,
  panelShortLinkCursorSchema,
  panelShortLinkItemSchema,
  panelShortLinksListSchema,
  panelShortLinksQuerySchema,
} from "../src/panel.ts";

function rejects(
  schema: { safeParse(value: unknown): { success: boolean } },
  value: unknown,
): void {
  expect(schema.safeParse(value).success).toBe(false);
}

describe("panel short link listing", () => {
  it("requires both cursor fields and validates the bounded page size", ({ expect }) => {
    const cursor = { createdAt: "2026-10-22T08:00:00.000Z", code: "k7mq4ra" };
    expect(panelShortLinksQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(
      panelShortLinksQuerySchema.parse({
        limit: "200",
        beforeCreatedAt: cursor.createdAt,
        beforeCode: cursor.code,
      }),
    ).toEqual({
      limit: 200,
      beforeCreatedAt: cursor.createdAt,
      beforeCode: cursor.code,
    });
    expect(panelShortLinkCursorSchema.parse(cursor)).toEqual(cursor);
    rejects(panelShortLinksQuerySchema, { beforeCreatedAt: cursor.createdAt });
    rejects(panelShortLinksQuerySchema, { beforeCode: cursor.code });
    rejects(panelShortLinksQuerySchema, { limit: "0" });
    rejects(panelShortLinksQuerySchema, { limit: "201" });
    for (const limit of ["0x10", "1e2", "+1", " 1", "1 ", "", " ", "-1"]) {
      rejects(panelShortLinksQuerySchema, { limit });
    }
    rejects(panelShortLinksQuerySchema, { unknown: "value" });
    rejects(panelShortLinkCursorSchema, { ...cursor, createdAt: "2026-10-22T08:00:00Z" });
  });

  it("accepts only safe metadata and a nullable next cursor", ({ expect }) => {
    const item = {
      code: "k7mq4ra",
      target: "https://example.org/materialy",
      file: null,
      createdAt: "2026-10-22T08:00:00.000Z",
      expiresAt: "2027-10-22T08:00:00.000Z",
      revokedAt: null,
      clicks: 0,
      passwordProtected: true,
    };
    expect(panelShortLinksListSchema.parse({ items: [item], nextCursor: null })).toEqual({
      items: [item],
      nextCursor: null,
    });
    rejects(panelShortLinkItemSchema, { ...item, password_hash: "secret" });
    rejects(panelShortLinksListSchema, { items: [item] });
  });

  it("describes either a target address or a file, never both or neither", ({ expect }) => {
    const base = {
      code: "k7mq4ra",
      createdAt: "2026-10-22T08:00:00.000Z",
      expiresAt: "2027-08-31T22:00:00.000Z",
      revokedAt: null,
      clicks: 2,
      passwordProtected: false,
    };
    const file = { name: "karta.pdf", format: "pdf", bytes: 1200 };
    const fileItem = { ...base, target: null, file };
    expect(panelShortLinkItemSchema.parse(fileItem)).toEqual(fileItem);
    expect(panelShortLinkCreatedSchema.parse({ item: fileItem })).toEqual({ item: fileItem });
    rejects(panelShortLinkItemSchema, { ...base, target: null, file: null });
    expect(
      panelShortLinkItemSchema.safeParse({ ...base, target: null, file: null }).error?.issues[0]
        ?.message,
    ).toBe("A link points to a target or to a file");
    rejects(panelShortLinkItemSchema, { ...base, target: "https://example.org/a", file });
    rejects(panelShortLinkItemSchema, { ...fileItem, file: { ...file, key: "s/abc" } });
    rejects(panelShortLinkCreatedSchema, { item: fileItem, password: "tajne1" });
  });
});
