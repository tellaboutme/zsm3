import { INDEXNOW_ENDPOINT, INDEXNOW_KEY } from "@zsm3/contracts/indexnow";
import { it } from "vitest";

import { newsSaveMutation, newsStatusMutation, sampleNews, staffMember } from "./panel-fixtures.ts";
import {
  panelEnv,
  PANEL_DOMAIN,
  panelEnvHarness,
  panelRawCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";

const ADMIN = staffMember("admin@zsm3.test", "admin", true);

const VALID_NOW = { nbf: 1_700_000_000, iat: 1_600_000_000, exp: 4_000_000_000 };

it("pings the search engine with the configured host once a draft gets published", async ({
  expect,
}) => {
  const env = panelEnv({ INDEXNOW_HOST: "search.zsm3.test" });
  const harness = await panelEnvHarness(env);
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email, VALID_NOW));
  const pings: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const target = input instanceof Request ? input.url : String(input);
    if (target === `https://${PANEL_DOMAIN}/cdn-cgi/access/certs`) {
      return new Response(harness.keys.document, {
        headers: { "content-type": "application/jwk-set+json" },
      });
    }
    if (target === INDEXNOW_ENDPOINT) {
      const body = typeof init?.body === "string" ? init.body : "";
      pings.push(body);
      return new Response(null, { status: 200 });
    }
    return original(input, init);
  };

  try {
    await panelRawCall(harness, "POST", "/news", {
      headers: {
        authorization: `Bearer ${token}`,
        origin: "https://zsm3.pl",
        "content-type": "application/json",
      },
      body: JSON.stringify(newsSaveMutation(sampleNews("salon-maturzystow", "Salon"))),
    });
    const published = await panelRawCall(harness, "PATCH", "/news/2026/salon-maturzystow", {
      headers: {
        authorization: `Bearer ${token}`,
        origin: "https://zsm3.pl",
        "content-type": "application/json",
      },
      body: JSON.stringify(newsStatusMutation("publish")),
    });
    expect(published.status).toBe(200);
    expect(pings).toHaveLength(1);
    const ping = pings[0];
    if (ping === undefined) {
      throw new Error("fixture");
    }
    const payload: unknown = JSON.parse(ping);
    expect(payload).toEqual({
      host: "search.zsm3.test",
      key: INDEXNOW_KEY,
      keyLocation: `https://search.zsm3.test/${INDEXNOW_KEY}.txt`,
      urlList: ["https://search.zsm3.test/aktualnosci/2026/salon-maturzystow"],
    });
  } finally {
    globalThis.fetch = original;
  }
});
