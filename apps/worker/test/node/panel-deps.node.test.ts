import { problemDetailsSchema } from "@zsm3/contracts/problem";
import { Hono } from "hono";
import { it, vi } from "vitest";

import { newsSaveMutation, sampleNews, staffMember } from "./panel-fixtures.ts";
import {
  expectProblem,
  panelEnv,
  PANEL_DOMAIN,
  panelEnvHarness,
  panelVerifierHarness,
  panelRawCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";
import type { AppEnv } from "../../src/app-env.ts";
import { createApp } from "../../src/app.ts";
import { requirePanelDeps, requirePanelSession, panelOrigin } from "../../src/routes/panel/deps.ts";
import { panelApp } from "../../src/routes/panel/index.ts";

const ADMIN = staffMember("admin@zsm3.test", "admin", true);

const VALID_NOW = { nbf: 1_700_000_000, iat: 1_600_000_000, exp: 4_000_000_000 };

it("requirePanelSession fails without a session", async ({ expect }) => {
  const probe = new Hono<AppEnv>().get("/probe", (c) => {
    requirePanelSession(c);
    return c.body(null, 204);
  });
  const response = await probe.request("/probe");

  expect(response.status).toBe(403);
});

it("requirePanelDeps fails without injected dependencies", async ({ expect }) => {
  const probe = new Hono<AppEnv>().get("/probe", (c) => {
    requirePanelDeps(c);
    return c.body(null, 204);
  });
  const response = await probe.request("/probe");

  expect(response.status).toBe(403);
});

it("builds the verifier from environment access settings", async ({ expect }) => {
  const harness = await panelEnvHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email, VALID_NOW));
  const original = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const target = url instanceof Request ? url.url : String(url);
    if (target === `https://${PANEL_DOMAIN}/cdn-cgi/access/certs`) {
      return new Response(harness.keys.document, {
        headers: { "content-type": "application/jwk-set+json" },
      });
    }
    return original(url, init);
  };

  try {
    const response = await panelRawCall(harness, "GET", "/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
  } finally {
    globalThis.fetch = original;
  }
});

it("accepts mutations guarded by the default panel origin", async ({ expect }) => {
  const harness = await panelVerifierHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  const response = await panelRawCall(harness, "POST", "/news", {
    headers: {
      authorization: `Bearer ${token}`,
      origin: "https://zsm3.pl",
      "content-type": "application/json",
    },
    body: JSON.stringify(newsSaveMutation(sampleNews("domyslne-pochodzenie", "Salon"))),
  });

  expect(response.status).toBe(201);
});

it("rejects mutations without the panel origin", async () => {
  const harness = await panelVerifierHarness();
  await seedStaff(harness.env, [ADMIN]);
  const token = await harness.keys.sign(staffClaims(ADMIN.email));

  await expectProblem(
    await panelRawCall(harness, "POST", "/news", {
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(newsSaveMutation(sampleNews("brak-pochodzenia", "Salon"))),
    }),
    403,
  );
});

it("serves the production origin unless the environment configures another one", ({ expect }) => {
  expect(panelOrigin(panelEnv())).toBe("https://zsm3.pl");
  expect(panelOrigin({ ...panelEnv(), PANEL_ORIGIN: "" })).toBe("https://zsm3.pl");
  expect(panelOrigin({ ...panelEnv(), PANEL_ORIGIN: "  " })).toBe("https://zsm3.pl");
  expect(panelOrigin({ ...panelEnv(), PANEL_ORIGIN: " http://127.0.0.1:8787 " })).toBe(
    "http://127.0.0.1:8787",
  );
  expect(panelOrigin({ ...panelEnv(), PANEL_ORIGIN: "http://127.0.0.1:8787" })).toBe(
    "http://127.0.0.1:8787",
  );
});

it("builds a standalone panel application", async ({ expect }) => {
  const app = panelApp();

  const response = await app.fetch(
    new Request("https://panel.zsm3.test/api/panel/me", { method: "GET" }),
    panelEnv(),
  );

  expect(response.status).toBe(401);
});

it("fails closed with a 503 when access environment variables are blank", async ({ expect }) => {
  const app = createApp();
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

  const env = { ...panelEnv(), ACCESS_TEAM_DOMAIN: "", ACCESS_AUDIENCE: "" };
  const response = await app.fetch(
    new Request("https://panel.zsm3.test/api/panel/me", {
      headers: { authorization: "Bearer garbage" },
    }),
    env,
  );
  const problem: unknown = await response.json();
  const details = problemDetailsSchema.parse(problem);
  expect(details.status).toBe(503);
  expect(details.title).toBe("Service Unavailable");

  const logCall = logged.mock.calls[0];
  if (logCall === undefined) {
    throw new Error("fixture");
  }
  const entry: unknown = JSON.parse(String(logCall[0]));
  expect(entry).toEqual({ event: "access_config_missing", requestId: details.requestId });
  logged.mockRestore();
});

it("fails closed when only one access variable is set or it is whitespace", async ({ expect }) => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  for (const blank of [
    { ACCESS_TEAM_DOMAIN: "", ACCESS_AUDIENCE: "aud" },
    { ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUDIENCE: "" },
    { ACCESS_TEAM_DOMAIN: "  ", ACCESS_AUDIENCE: "aud" },
    { ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUDIENCE: "  " },
  ]) {
    const response = await createApp().fetch(
      new Request("https://panel.zsm3.test/api/panel/me", {
        headers: { authorization: "Bearer garbage" },
      }),
      { ...panelEnv(), ...blank },
    );
    expect(response.status).toBe(503);
  }
});
