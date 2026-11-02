import { it } from "vitest";

import { indexNowSession, publishedSalon, SALON, SALON_API_PATH } from "./indexnow-spy.ts";
import { newsSaveMutation, pageSaveMutation, samplePage } from "./panel-fixtures.ts";
import { panelJsonCall } from "./panel-support.ts";

function restoreBody(target: string, id: string, revision: number): unknown {
  return { entity: "revisions", target, id, revision };
}

it("announces a restored version of a public page", async ({ expect }) => {
  const session = await indexNowSession();
  for (const title of ["Kontakt", "Kontakt i dojazd"]) {
    await panelJsonCall(session.harness, "PUT", "/pages/kontakt", {
      token: session.token,
      body: pageSaveMutation(samplePage("/kontakt", title), "published"),
    });
  }
  session.pegs.length = 0;

  const restored = await panelJsonCall(session.harness, "POST", "/revisions/restore", {
    token: session.token,
    body: restoreBody("pages", "/kontakt", 1),
  });

  expect(restored.status).toBe(200);
  expect(session.pegs).toEqual([["/kontakt"]]);
});

it("announces a restored version of a published article", async ({ expect }) => {
  const session = await indexNowSession();
  await publishedSalon(session);
  await panelJsonCall(session.harness, "PUT", SALON_API_PATH, {
    token: session.token,
    body: newsSaveMutation({ ...SALON, title: "Salon Maturzystow 2026" }),
  });
  session.pegs.length = 0;

  const restored = await panelJsonCall(session.harness, "POST", "/revisions/restore", {
    token: session.token,
    body: restoreBody("news", "2026/salon-maturzystow", 2),
  });

  expect(restored.status).toBe(200);
  expect(session.pegs).toEqual([["/aktualnosci/2026/salon-maturzystow"]]);
});

it("keeps quiet when a restored version equals the current one", async ({ expect }) => {
  const session = await indexNowSession();
  await publishedSalon(session);

  const restored = await panelJsonCall(session.harness, "POST", "/revisions/restore", {
    token: session.token,
    body: restoreBody("news", "2026/salon-maturzystow", 1),
  });

  expect(restored.status).toBe(200);
  expect(session.pegs).toEqual([]);
});

it("keeps quiet when a draft page or article is restored", async ({ expect }) => {
  const session = await indexNowSession();
  for (const title of ["Kontakt", "Kontakt i dojazd"]) {
    await panelJsonCall(session.harness, "PUT", "/pages/kontakt", {
      token: session.token,
      body: pageSaveMutation(samplePage("/kontakt", title), "draft"),
    });
  }
  await panelJsonCall(session.harness, "POST", "/news", {
    token: session.token,
    body: newsSaveMutation(SALON),
  });
  await panelJsonCall(session.harness, "PUT", SALON_API_PATH, {
    token: session.token,
    body: newsSaveMutation({ ...SALON, title: "Inny tytul" }),
  });

  for (const [target, id] of [
    ["pages", "/kontakt"],
    ["news", "2026/salon-maturzystow"],
  ] as const) {
    const restored = await panelJsonCall(session.harness, "POST", "/revisions/restore", {
      token: session.token,
      body: restoreBody(target, id, 1),
    });
    expect(restored.status).toBe(200);
  }
  expect(session.pegs).toEqual([]);
});
