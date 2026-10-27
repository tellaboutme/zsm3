import { panelNewsItemSchema } from "@zsm3/contracts/panel";
import { it } from "vitest";
import { z } from "zod";

import { newsSaveMutation, sampleNews, staffMember } from "./panel-fixtures.ts";
import {
  expectProblem,
  panelAudit,
  panelHarness,
  panelJsonCall,
  panelRevisions,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";

const ADMIN = staffMember("admin@zsm3.test", "admin", true);

function fieldsOf(json: string): readonly string[] {
  const fields: unknown = JSON.parse(json);
  return z.object({ fields: z.array(z.string()) }).parse(fields).fields;
}

async function patchStatus(
  harness: Awaited<ReturnType<typeof panelHarness>>,
  token: string,
  action: "publish" | "unpublish",
): Promise<Response> {
  return panelJsonCall(harness, "PATCH", "/news/2026/salon-maturzystow", {
    token,
    body: { entity: "news", mutation: { action } },
  });
}

it("updates drafts while keeping previous data as a revision", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await panelJsonCall(harness, "POST", "/news", {
    token,
    body: newsSaveMutation(sampleNews("salon-maturzystow", "Salon Maturzystow")),
  });

  const changed = sampleNews("salon-maturzystow", "Salon Maturzystow 2026");
  const updated = await panelJsonCall(harness, "PUT", "/news/2026/salon-maturzystow", {
    token,
    body: newsSaveMutation(changed),
  });
  expect(updated.status).toBe(200);

  const revisions = await panelRevisions(harness.env).list("news", "2026/salon-maturzystow");
  const revision = revisions[0];
  if (revision === undefined) {
    throw new Error("fixture");
  }
  expect(revision.revision).toBe(1);
  expect(revision.actorEmail).toBe(ADMIN.email);
  const revisionData: unknown = JSON.parse(revision.dataJson);
  expect(panelNewsItemSchema.parse(revisionData)).toEqual({
    ...sampleNews("salon-maturzystow", "Salon Maturzystow"),
    status: "draft",
  });

  const updates = await panelAudit(harness.env).byEntity("news", "2026/salon-maturzystow", 10);
  const update = updates.find((row) => row.action === "news.update");
  if (update === undefined) {
    throw new Error("fixture");
  }
  expect(fieldsOf(update.details)).toEqual(["title"]);

  const again = await panelJsonCall(harness, "PUT", "/news/2026/salon-maturzystow", {
    token,
    body: newsSaveMutation(changed),
  });
  expect(again.status).toBe(200);
  const records = await panelAudit(harness.env).byEntity("news", "2026/salon-maturzystow", 10);
  expect(fieldsOf(records[0]?.details ?? "")).toEqual([]);
});

it("rejects updates with invalid references and bodies", async () => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await panelJsonCall(harness, "POST", "/news", {
    token,
    body: newsSaveMutation(sampleNews("salon-maturzystow", "Salon Maturzystow")),
  });

  await expectProblem(
    await panelJsonCall(harness, "PUT", "/news/2026/BRak", { token, body: {} }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/news/2026/salon-maturzystow", {
      token,
      body: { entity: "news", mutation: { action: "publish" } },
    }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/news/2026/salon-maturzystow", {
      token,
      body: newsSaveMutation(sampleNews("innegaty-salon", "Niezgodny slug")),
    }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/news/2026/salon-maturzystow", {
      token,
      body: newsSaveMutation(
        sampleNews("salon-maturzystow", "Zmiana roku", { date: "2025-05-05" }),
      ),
    }),
    422,
  );
  await expectProblem(
    await panelJsonCall(harness, "PUT", "/news/2026/brak", {
      token,
      body: newsSaveMutation(sampleNews("brak", "Brak salon")),
    }),
    404,
  );
  await expectProblem(
    await panelJsonCall(harness, "PATCH", "/news/2026/BRak", { token, body: {} }),
    422,
  );
});

it("writes a revision and audit row when the publication status flips", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await panelJsonCall(harness, "POST", "/news", {
    token,
    body: newsSaveMutation(sampleNews("salon-maturzystow", "Salon Maturzystow")),
  });

  expect((await patchStatus(harness, token, "publish")).status).toBe(200);

  const revisions = await panelRevisions(harness.env).list("news", "2026/salon-maturzystow");
  const revision = revisions[0];
  if (revision === undefined) {
    throw new Error("fixture");
  }
  expect(revision.revision).toBe(1);
  const revisionData: unknown = JSON.parse(revision.dataJson);
  expect(panelNewsItemSchema.parse(revisionData)).toEqual({
    ...sampleNews("salon-maturzystow", "Salon Maturzystow"),
    status: "draft",
  });

  const publishes = await panelAudit(harness.env).byEntity("news", "2026/salon-maturzystow", 10);
  expect(publishes.map((row) => row.action)).toEqual(["news.publish", "news.create"]);
});

it("rejects publication flips that change nothing", async ({ expect }) => {
  const harness = await panelHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await panelJsonCall(harness, "POST", "/news", {
    token,
    body: newsSaveMutation(sampleNews("salon-maturzystow", "Salon Maturzystow")),
  });

  const onDraft = await patchStatus(harness, token, "unpublish");
  expect(onDraft.status).toBe(422);
  const draftProblem: unknown = await onDraft.json();
  expect(draftProblem).toEqual(expect.objectContaining({ title: "Publication Status Unchanged" }));

  expect((await patchStatus(harness, token, "publish")).status).toBe(200);
  await expectProblem(await patchStatus(harness, token, "publish"), 422);
  const revisions = await panelRevisions(harness.env).list("news", "2026/salon-maturzystow");
  expect(revisions).toHaveLength(1);
});
