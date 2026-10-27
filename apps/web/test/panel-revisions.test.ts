import { it } from "vitest";

import { restoreMutation, revisionLine, revisionsPath } from "../src/lib/panel/revisions.ts";

it("addresses the version list of one item", ({ expect }) => {
  expect(revisionsPath("pages", "/szkola/historia")).toBe(
    "/api/panel/revisions/pages?id=%2Fszkola%2Fhistoria",
  );
  expect(revisionsPath("news", "2026/salon")).toBe("/api/panel/revisions/news?id=2026%2Fsalon");
});

it("describes a version in Polish and Warsaw time", ({ expect }) => {
  const item = {
    revision: 3,
    at: "2026-10-26T13:05:00.000Z",
    actorEmail: "redakcja@zsm3.pl",
    title: "Kontakt",
    status: "published",
  } as const;
  const line = revisionLine(item);
  expect(line.startsWith("Wersja 3 · 26 października 2026")).toBe(true);
  expect(line).toContain("14:05");
  expect(line.endsWith(" · redakcja@zsm3.pl · opublikowana")).toBe(true);
  expect(revisionLine({ ...item, actorEmail: null, status: "draft" })).toContain(
    "· system · szkic",
  );
});

it("asks to restore a version", ({ expect }) => {
  expect(restoreMutation("news", "2026/salon", 2)).toEqual({
    entity: "revisions",
    target: "news",
    id: "2026/salon",
    revision: 2,
  });
});
