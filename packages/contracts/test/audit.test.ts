import { it } from "vitest";

import { auditCursorSchema, panelAuditListSchema } from "../src/audit.ts";

const ITEM = {
  at: "2026-10-26T08:00:00.000Z",
  actorEmail: null,
  action: "news.update",
  entity: "news",
  entityId: "2026/salon",
  fields: ["title"],
};

it("carries a page of audit entries and the cursor of the next one", ({ expect }) => {
  const next = "2026-10-26T08:00:00.000Z|0199a000-0000-7000-8000-000000000001";
  expect(panelAuditListSchema.parse({ items: [ITEM], next }).next).toBe(next);
  expect(panelAuditListSchema.safeParse({ items: [ITEM], next: null }).success).toBe(true);
  expect(auditCursorSchema.safeParse("x2026|abc").success).toBe(false);
  expect(auditCursorSchema.safeParse("2026|abc x").success).toBe(false);
  expect(auditCursorSchema.safeParse("2026abc").success).toBe(false);
  expect(
    panelAuditListSchema.safeParse({ items: Array.from({ length: 51 }, () => ITEM), next: null })
      .success,
  ).toBe(false);
});
