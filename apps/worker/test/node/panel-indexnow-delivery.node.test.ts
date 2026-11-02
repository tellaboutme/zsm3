import { it, vi } from "vitest";
import { z } from "zod";

import { indexNowSession, publishedSalon, SALON, SALON_API_PATH } from "./indexnow-spy.ts";
import { newsSaveMutation, pageSaveMutation, samplePage } from "./panel-fixtures.ts";
import { panelSpyHarness, SPY_ADMIN, spyToken } from "./panel-spy.ts";
import {
  panelEnv,
  PANEL_DOMAIN,
  PANEL_ORIGIN,
  panelEnvHarness,
  panelJsonCall,
  panelJsonRequest,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";
import type { IndexNowEndpoint } from "../../src/services/indexnow.ts";

const CONTACT = samplePage("/kontakt", "Kontakt");

const VALID_NOW = { nbf: 1_700_000_000, iat: 1_600_000_000, exp: 4_000_000_000 };

it("announces nothing when the batch fails and rolls back", async ({ expect }) => {
  const pegs: string[][] = [];
  const harness = await panelSpyHarness({
    submit: async (urls) => {
      pegs.push([...urls]);
      return Promise.resolve(true);
    },
  });
  await seedStaff(harness.env, [SPY_ADMIN]);
  const token = await spyToken(harness);
  harness.failAudit();

  const saved = await panelJsonCall(harness, "PUT", "/pages/kontakt", {
    token,
    body: pageSaveMutation(CONTACT, "published"),
  });

  expect(saved.status).toBe(500);
  expect(pegs).toEqual([]);
});

const REJECTIONS: readonly (readonly [unknown, string])[] = [
  [new TypeError("network down"), "TypeError"],
  ["unavailable", "unknown"],
];

it.for(REJECTIONS)(
  "keeps the committed save when the endpoint rejects with %s",
  async ([reason, errorName], { expect }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const session = await indexNowSession({
      pegs: [],
      endpoint: { submit: vi.fn<IndexNowEndpoint["submit"]>().mockRejectedValue(reason) },
    });

    const pending: Promise<unknown>[] = [];
    const execution = {
      waitUntil: (task: Promise<unknown>) => {
        pending.push(task);
      },
      passThroughOnException: () => undefined,
      props: {},
    };

    const saved = await session.harness.app.fetch(
      panelJsonRequest(
        "PUT",
        "/pages/kontakt",
        session.token,
        pageSaveMutation(CONTACT, "published"),
      ),
      session.harness.env,
      execution,
    );
    const shown = await panelJsonCall(session.harness, "GET", "/pages/kontakt", {
      token: session.token,
    });

    expect(saved.status).toBe(200);
    await expect(Promise.all(pending)).resolves.toEqual([false]);
    expect(await shown.json()).toMatchObject({ item: { status: "published" } });
    expect(logged).toHaveBeenCalledOnce();
    expect(String(logged.mock.calls[0]?.[0])).toContain(`"errorName":"${errorName}"`);
    expect(String(logged.mock.calls[0]?.[0])).not.toContain("kontakt");
    logged.mockRestore();
  },
);

it("keeps the committed edit when the endpoint refuses", async ({ expect }) => {
  const pegs: string[][] = [];
  const session = await indexNowSession({
    pegs,
    endpoint: {
      submit: async (urls) => {
        pegs.push([...urls]);
        return Promise.resolve(false);
      },
    },
  });
  await publishedSalon(session);

  const edited = await panelJsonCall(session.harness, "PUT", SALON_API_PATH, {
    token: session.token,
    body: newsSaveMutation({ ...SALON, lead: "Poprawiony lead." }),
  });
  const shown = await panelJsonCall(session.harness, "GET", SALON_API_PATH, {
    token: session.token,
  });

  expect(edited.status).toBe(200);
  expect(pegs).toEqual([["/aktualnosci/2026/salon-maturzystow"]]);
  expect(await shown.json()).toMatchObject({
    item: { lead: "Poprawiony lead.", status: "published" },
  });
});

const SHARED_KEYS = panelEnvHarness();

async function savedThroughEnv(host: string | undefined): Promise<readonly string[]> {
  const harness = {
    ...(await SHARED_KEYS),
    env: panelEnv({ PANEL_ORIGIN, ...(host === undefined ? {} : { INDEXNOW_HOST: host }) }),
  };
  await seedStaff(harness.env, [SPY_ADMIN]);
  const token = await harness.keys.sign(staffClaims(SPY_ADMIN.email, VALID_NOW));
  const outbound: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const target = input instanceof Request ? input.url : String(input);
    if (target === `https://${PANEL_DOMAIN}/cdn-cgi/access/certs`) {
      return Promise.resolve(new Response(harness.keys.document));
    }
    outbound.push(typeof init?.body === "string" ? init.body : target);
    return Promise.resolve(new Response(null, { status: 202 }));
  };
  try {
    for (const status of ["published", "draft"] as const) {
      const saved = await panelJsonCall(harness, "PUT", "/pages/kontakt", {
        token,
        body: pageSaveMutation(CONTACT, status),
      });
      outbound.push(`status ${String(saved.status)}`);
    }
  } finally {
    globalThis.fetch = original;
  }
  return outbound;
}

it("sends nothing at all while the host is not configured", async ({ expect }) => {
  await expect(savedThroughEnv(undefined)).resolves.toEqual(["status 200", "status 200"]);
});

it("sends the full public address for publication and withdrawal", async ({ expect }) => {
  const outbound = await savedThroughEnv("search.zsm3.test");

  expect(outbound.filter((entry) => entry.startsWith("status"))).toEqual([
    "status 200",
    "status 200",
  ]);
  const lists = outbound
    .filter((entry) => entry.startsWith("{"))
    .map((entry) => z.object({ urlList: z.array(z.string()) }).parse(JSON.parse(entry)).urlList);
  expect(lists).toEqual([
    ["https://search.zsm3.test/kontakt"],
    ["https://search.zsm3.test/kontakt"],
  ]);
});
