import { it } from "vitest";

import { panelMutationSchema } from "../src/panel.ts";
import { panelRevisionListSchema, revisionTargetSchema } from "../src/revisions.ts";

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
    }).success,
  ).toBe(true);
  expect(
    panelMutationSchema.safeParse({
      entity: "revisions",
      target: "events",
      id: "2026",
      revision: 1,
    }).success,
  ).toBe(false);
  expect(
    panelMutationSchema.safeParse({
      entity: "revisions",
      target: "pages",
      id: "/kontakt",
      revision: 0,
    }).success,
  ).toBe(false);
});
