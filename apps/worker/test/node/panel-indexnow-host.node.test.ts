import { INDEXNOW_ENDPOINT } from "@zsm3/contracts/indexnow";
import { it, vi } from "vitest";

import { newsSaveMutation, newsStatusMutation, sampleNews, staffMember } from "./panel-fixtures.ts";
import {
  panelEnv,
  PANEL_DOMAIN,
  panelEnvHarness,
  panelHarness,
  panelJsonCall,
  panelJsonRequest,
  panelKeys,
  panelRawCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";
import type { PanelKeys } from "./panel-support.ts";
import type { IndexNowEndpoint } from "../../src/services/indexnow.ts";

const ADMIN = staffMember("admin@zsm3.test", "admin", true);

const VALID_NOW = { nbf: 1_700_000_000, iat: 1_600_000_000, exp: 4_000_000_000 };

interface PublishOutcome {
  readonly status: number;
  readonly pings: number;
}

const sharedKeys: Promise<PanelKeys> = panelKeys();

async function publishWithHost(host: string | undefined): Promise<PublishOutcome> {
  const env = panelEnv(host === undefined ? {} : { INDEXNOW_HOST: host });
  const harness = { ...(await panelEnvHarness(env)), keys: await sharedKeys };
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email, VALID_NOW));
  let pings = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const target = input instanceof Request ? input.url : String(input);
    if (target === `https://${PANEL_DOMAIN}/cdn-cgi/access/certs`) {
      return new Response(harness.keys.document, {
        headers: { "content-type": "application/jwk-set+json" },
      });
    }
    if (target === INDEXNOW_ENDPOINT) {
      pings += 1;
      return new Response(null, { status: 200 });
    }
    return original(input, init);
  };
  const headers = {
    authorization: `Bearer ${token}`,
    origin: "https://zsm3.pl",
    "content-type": "application/json",
  };
  try {
    await panelRawCall(harness, "POST", "/news", {
      headers,
      body: JSON.stringify(newsSaveMutation(sampleNews("salon-maturzystow", "Salon"))),
    });
    const published = await panelRawCall(harness, "PATCH", "/news/2026/salon-maturzystow", {
      headers,
      body: JSON.stringify(newsStatusMutation("publish")),
    });
    return { status: published.status, pings };
  } finally {
    globalThis.fetch = original;
  }
}

it("publishes without contacting search engines when no host is configured", async ({ expect }) => {
  await expect(publishWithHost(undefined)).resolves.toEqual({ status: 200, pings: 0 });
});

it("treats a blank host as not configured", async ({ expect }) => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

  await expect(publishWithHost("   ")).resolves.toEqual({ status: 200, pings: 0 });
  expect(logged).not.toHaveBeenCalled();
  logged.mockRestore();
});

it("publishes and logs a malformed host instead of failing the saved item", async ({ expect }) => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

  await expect(publishWithHost("https://www.zsm3.pl")).resolves.toEqual({
    status: 200,
    pings: 0,
  });
  expect(logged).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ event: "indexnow_unavailable", errorName: "InvalidHost" }),
  );
  logged.mockRestore();
});

it("trims the configured host before submitting", async ({ expect }) => {
  await expect(publishWithHost("  search.zsm3.test  ")).resolves.toEqual({
    status: 200,
    pings: 1,
  });
});

it("answers the publish before the search engine replies", async ({ expect }) => {
  const submitted: string[][] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const endpoint: IndexNowEndpoint = {
    submit: async (urls) => {
      submitted.push([...urls]);
      await gate;
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
  const pending: Promise<unknown>[] = [];
  const execution = {
    waitUntil: (task: Promise<unknown>) => {
      pending.push(task);
    },
    passThroughOnException: () => undefined,
    props: {},
  };

  const published = await harness.app.fetch(
    panelJsonRequest("PATCH", "/news/2026/salon-maturzystow", token, newsStatusMutation("publish")),
    harness.env,
    execution,
  );

  expect(published.status).toBe(200);
  expect(submitted).toEqual([["/aktualnosci/2026/salon-maturzystow"]]);
  expect(pending).toHaveLength(1);
  release();
  await expect(Promise.all(pending)).resolves.toEqual([true]);
});
