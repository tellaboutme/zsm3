import { datasetKeySchema, panelDatasetViewSchema } from "@zsm3/contracts/datasets";
import { panelRevisionListSchema } from "@zsm3/contracts/revisions";
import { it } from "vitest";

import { staffMember } from "./panel-fixtures.ts";
import type { PanelHarness } from "./panel-support.ts";
import {
  expectProblem,
  panelAudit,
  panelHarness,
  panelJsonCall,
  panelRevisions,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";
import { mediaReferences } from "../../src/routes/panel/datasets.ts";
import { systemClock } from "../../src/storage/database.ts";
import { filesRepo } from "../../src/storage/files-repo.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";

const EDITOR = staffMember("redakcja@zsm3.test", "editor", true);
const SHA = "a".repeat(64);
const PARTNERS = [{ name: "LS Airport Services", role: "partner kierunków lotniczych" }];

async function signedIn(): Promise<{ harness: PanelHarness; token: string }> {
  const harness = await panelHarness();
  await seedStaff(harness.env, [EDITOR]);
  return { harness, token: await harness.keys.sign(staffClaims(EDITOR.email)) };
}

function saveBody(key: string, data: unknown): unknown {
  return { entity: "datasets", key, data };
}

it("serves every dataset the migration stored", async ({ expect }) => {
  const { harness, token } = await signedIn();
  for (const key of datasetKeySchema.options) {
    const response = await panelJsonCall(harness, "GET", `/datasets/${key}`, { token });
    expect(response.status, key).toBe(200);
    expect(panelDatasetViewSchema.parse(await response.json()).key).toBe(key);
  }
});

it("saves a dataset, keeps the previous version and audits the change", async ({ expect }) => {
  const { harness, token } = await signedIn();

  const saved = await panelJsonCall(harness, "PUT", "/datasets/partnerzy", {
    token,
    body: saveBody("partnerzy", PARTNERS),
  });
  expect(saved.status).toBe(200);
  expect(await saved.json()).toEqual({ ok: true });
  const view = panelDatasetViewSchema.parse(
    await (await panelJsonCall(harness, "GET", "/datasets/partnerzy", { token })).json(),
  );
  expect(view.data).toEqual(PARTNERS);
  const revision = await panelRevisions(harness.env).latest("datasets", "partnerzy");
  expect(JSON.parse(revision?.dataJson ?? "[]")).toHaveLength(3);
  const [audit] = await panelAudit(harness.env).byEntity("datasets", "partnerzy", 1);
  expect(audit?.action).toBe("datasets.save");

  const listed = panelRevisionListSchema.parse(
    await (
      await panelJsonCall(harness, "GET", "/revisions/datasets?id=partnerzy", { token })
    ).json(),
  );
  expect(listed.items.map(({ title, status }) => [title, status])).toEqual([
    ["Zestaw partnerzy", "published"],
  ]);
  const restored = await panelJsonCall(harness, "POST", "/revisions/restore", {
    token,
    body: { entity: "revisions", target: "datasets", id: "partnerzy", revision: 1 },
  });
  expect(restored.status).toBe(200);
  const back = panelDatasetViewSchema.parse(
    await (await panelJsonCall(harness, "GET", "/datasets/partnerzy", { token })).json(),
  );
  expect(back.data).toHaveLength(3);
});

it("links documents only to uploaded files", async ({ expect }) => {
  const { harness, token } = await signedIn();
  const offer = {
    employer: "LS Airport Services",
    position: "Mechanik",
    validUntil: "2026-12-31",
    file: { href: `/media/d/${SHA}.pdf`, bytes: 1200 },
  };

  const missing = await expectProblem(
    await panelJsonCall(harness, "PUT", "/datasets/oferty-pracy", {
      token,
      body: saveBody("oferty-pracy", [offer]),
    }),
    422,
  );
  expect(missing.title).toBe("Unknown File");
  await filesRepo({ db: harness.env.DB, clock: systemClock, random: cryptoRandom }).save({
    key: `d/${SHA}.pdf`,
    name: "oferta.pdf",
    format: "pdf",
    bytes: 1200,
  });
  const saved = await panelJsonCall(harness, "PUT", "/datasets/oferty-pracy", {
    token,
    body: saveBody("oferty-pracy", [offer]),
  });
  expect(saved.status).toBe(200);
});

it("finds every media link in a dataset", ({ expect }) => {
  expect(
    mediaReferences([
      { href: `/media/d/${SHA}.pdf` },
      { nested: { href: `/media/d/${"b".repeat(64)}.docx` } },
      { href: "/kontakt" },
    ]),
  ).toEqual([`d/${SHA}.pdf`, `d/${"b".repeat(64)}.docx`]);
});

it("rejects invalid datasets and keys", async () => {
  const { harness, token } = await signedIn();
  const cases: readonly [string, unknown][] = [
    ["/datasets/partnerzy", saveBody("partnerzy", [{ name: "", role: "x" }])],
    ["/datasets/partnerzy", saveBody("kadra", PARTNERS)],
    ["/datasets/nieznane", saveBody("partnerzy", PARTNERS)],
    ["/datasets/partnerzy", { entity: "redirects", item: { from: "/a", to: "/kontakt" } }],
  ];
  for (const [path, body] of cases) {
    await expectProblem(await panelJsonCall(harness, "PUT", path, { token, body }), 422);
  }
  await expectProblem(await panelJsonCall(harness, "GET", "/datasets/nieznane", { token }), 422);
});

it("answers 404 for a dataset missing from the database and saves it fresh", async ({ expect }) => {
  const { harness, token } = await signedIn();
  await harness.env.DB.prepare("DELETE FROM datasets WHERE key = 'partnerzy'").run();

  await expectProblem(await panelJsonCall(harness, "GET", "/datasets/partnerzy", { token }), 404);
  const saved = await panelJsonCall(harness, "PUT", "/datasets/partnerzy", {
    token,
    body: saveBody("partnerzy", PARTNERS),
  });
  expect(saved.status).toBe(200);
  expect(await panelRevisions(harness.env).latest("datasets", "partnerzy")).toBeUndefined();
});

it("refuses dataset versions that no longer fit or belong to nothing", async () => {
  const { harness, token } = await signedIn();
  const revisions = panelRevisions(harness.env);
  await revisions.append("datasets", "partnerzy", JSON.stringify([{ name: "" }]), EDITOR.email);
  await revisions.append("datasets", "nieznane", JSON.stringify([]), EDITOR.email);
  await revisions.append("datasets", "kadra", JSON.stringify([]), EDITOR.email);
  await harness.env.DB.prepare("DELETE FROM datasets WHERE key = 'kadra'").run();

  for (const [id, status] of [
    ["partnerzy", 422],
    ["nieznane", 422],
    ["kadra", 404],
  ] as const) {
    await expectProblem(
      await panelJsonCall(harness, "POST", "/revisions/restore", {
        token,
        body: { entity: "revisions", target: "datasets", id, revision: 1 },
      }),
      status,
    );
  }
});
