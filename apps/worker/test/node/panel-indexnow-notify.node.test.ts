import { it, vi } from "vitest";

import { newsSaveMutation, newsStatusMutation, sampleNews, staffMember } from "./panel-fixtures.ts";
import { panelEnv, panelHarness, panelJsonCall, seedStaff, staffClaims } from "./panel-support.ts";
import { indexNowNotify } from "../../src/routes/panel/deps.ts";
import type { IndexNowEndpoint } from "../../src/services/indexnow.ts";

const ADMIN = staffMember("admin@zsm3.test", "admin", true);

it("reports nothing submitted while the host is missing or blank", async ({ expect }) => {
  await expect(indexNowNotify(panelEnv())("/aktualnosci/2026/salon")).resolves.toBe(false);
  await expect(indexNowNotify(panelEnv({ INDEXNOW_HOST: " " }))("/kontakt")).resolves.toBe(false);
});

it("reports nothing submitted for a malformed host", async ({ expect }) => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const notify = indexNowNotify(panelEnv({ INDEXNOW_HOST: "www.zsm3.pl/aktualnosci" }));

  await expect(notify("/kontakt")).resolves.toBe(false);
  expect(logged).toHaveBeenCalledOnce();
  logged.mockRestore();
});

it("waits for the submission when the runtime offers no execution context", async ({ expect }) => {
  const order: string[] = [];
  const endpoint: IndexNowEndpoint = {
    submit: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("submitted");
      return true;
    },
  };
  const harness = await panelHarness({ indexnow: endpoint });
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));
  await panelJsonCall(harness, "POST", "/news", {
    token,
    body: newsSaveMutation(sampleNews("salon-maturzystow", "Salon Maturzystow")),
  });

  const published = await panelJsonCall(harness, "PATCH", "/news/2026/salon-maturzystow", {
    token,
    body: newsStatusMutation("publish"),
  });
  order.push("answered");

  await expect(published.json()).resolves.toEqual({ ok: true });
  expect(order).toEqual(["submitted", "answered"]);
});
