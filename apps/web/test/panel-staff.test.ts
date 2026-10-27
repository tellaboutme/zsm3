import { it } from "vitest";

import {
  isOwnAccount,
  staffDraft,
  staffRoleLabel,
  STAFF_ROLE_OPTIONS,
  staffSummary,
} from "../src/lib/panel/staff.ts";

it("offers every role with a Polish label and its scope", ({ expect }) => {
  expect(STAFF_ROLE_OPTIONS.map((option) => option.value)).toEqual([
    "admin",
    "secretariat",
    "editor",
    "gallery_editor",
  ]);
  expect(STAFF_ROLE_OPTIONS[2]?.label).toBe(
    "redaktor treści — treści strony: aktualności, strony, terminarz, dokumenty, ogłoszenia, dzwonki",
  );
  expect(staffRoleLabel("gallery_editor")).toBe("redaktor galerii");
});

it("accepts only complete staff drafts", ({ expect }) => {
  expect(staffDraft(" Nowa@ZSM3.pl ", "editor", true)).toEqual({
    email: "nowa@zsm3.pl",
    role: "editor",
    active: true,
  });
  expect(staffDraft("nowa", "editor", true)).toBeUndefined();
  expect(staffDraft("nowa@zsm3.pl", "dyrektor", true)).toBeUndefined();
});

it("recognises the signed-in account", ({ expect }) => {
  expect(isOwnAccount(" Admin@zsm3.pl", "admin@zsm3.pl")).toBe(true);
  expect(isOwnAccount("admin@zsm3.pl", "inny@zsm3.pl")).toBe(false);
  expect(isOwnAccount(undefined, "admin@zsm3.pl")).toBe(false);
});

it("summarises active and disabled accounts", ({ expect }) => {
  expect(staffSummary(3, 0)).toBe("Aktywne konta: 3.");
  expect(staffSummary(3, 1)).toBe("Aktywne konta: 2, wyłączone: 1.");
});
