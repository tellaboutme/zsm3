import { it } from "vitest";

import { panelMutationSchema } from "../src/panel.ts";
import {
  panelRevisionListSchema,
  panelSavedSchema,
  revisionTargetSchema,
} from "../src/revisions.ts";

it("lists version summaries and restores news, pages or datasets only", ({ expect }) => {
  expect(
    panelRevisionListSchema.parse({
      items: [
        { revision: 2, at: "2026-10-26", actorEmail: null, title: "Kontakt", status: "draft" },
      ],
    }).items,
  ).toHaveLength(1);
  expect(revisionTargetSchema.options).toEqual(["news", "pages", "datasets"]);
  expect(
    panelMutationSchema.safeParse({
      entity: "revisions",
      target: "pages",
      id: "/kontakt",
      revision: 1,
      expectedRevision: 0,
    }).success,
  ).toBe(true);
  expect(
    panelMutationSchema.safeParse({
      entity: "revisions",
      target: "pages",
      id: "/kontakt",
      revision: 1,
    }).success,
  ).toBe(false);
  expect(
    panelMutationSchema.safeParse({
      entity: "revisions",
      target: "events",
      id: "2026",
      revision: 1,
      expectedRevision: 0,
    }).success,
  ).toBe(false);
  expect(
    panelMutationSchema.safeParse({
      entity: "revisions",
      target: "pages",
      id: "/kontakt",
      revision: 0,
      expectedRevision: 0,
    }).success,
  ).toBe(false);
});

it("answers a save with the revision the next write must expect", ({ expect }) => {
  expect(panelSavedSchema.parse({ ok: true, revision: 0 })).toEqual({ ok: true, revision: 0 });
  expect(panelSavedSchema.parse({ ok: true, revision: 12 }).revision).toBe(12);
  for (const answer of [
    { ok: true },
    { ok: false, revision: 1 },
    { ok: true, revision: -1 },
    { ok: true, revision: 1.5 },
    { ok: true, revision: Number.MAX_SAFE_INTEGER + 2 },
    { ok: true, revision: 1, extra: 1 },
  ]) {
    expect(panelSavedSchema.safeParse(answer).success).toBe(false);
  }
});
