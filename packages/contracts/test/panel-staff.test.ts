import { it } from "vitest";

import { panelMutationSchema, panelStaffListSchema, panelStaffMemberSchema } from "../src/panel.ts";

it("validates staff members", ({ expect }) => {
  expect(
    panelStaffMemberSchema.parse({ email: " Nowa@ZSM3.pl", role: "editor", active: true }),
  ).toEqual({ email: "nowa@zsm3.pl", role: "editor", active: true });
  for (const item of [
    { email: "nowa@zsm3", role: "editor", active: true },
    { email: "nowa@zsm3.pl", role: "dyrektor", active: true },
    { email: `${"a".repeat(320)}@zsm3.pl`, role: "admin", active: true },
  ]) {
    expect(panelStaffMemberSchema.safeParse(item).success).toBe(false);
  }
});

it("carries staff lists and staff mutations", ({ expect }) => {
  expect(
    panelStaffListSchema.parse({
      items: [{ email: "a@zsm3.pl", role: "gallery_editor", active: false, updatedAt: "x" }],
    }).items,
  ).toHaveLength(1);
  expect(
    panelMutationSchema.parse({
      entity: "staff",
      item: { email: "a@zsm3.pl", role: "secretariat", active: true },
    }).entity,
  ).toBe("staff");
});
