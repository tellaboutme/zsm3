import { Hono } from "hono";
import { describe, it } from "vitest";

import type { AppEnv } from "../../src/app-env.ts";
import { assignRequestId } from "../../src/http/request-id.ts";
import { requireOrigin } from "../../src/security/origin.ts";

const GET = "GET";
const POST = "POST";

function panelApp(middleware: ReturnType<typeof requireOrigin>): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use(assignRequestId, middleware);
  app.all("/api/panel", (c) => c.body("ok", 200));
  return app;
}

interface PanelRequest {
  readonly method: string;
  readonly origin?: string | undefined;
  readonly contentType?: string | undefined;
}

async function request(app: Hono<AppEnv>, init: PanelRequest): Promise<Response> {
  const headers = new Headers();
  if (init.origin !== undefined) {
    headers.set("Origin", init.origin);
  }
  if (init.contentType !== undefined) {
    headers.set("Content-Type", init.contentType);
  }
  return app.request("/api/panel", { method: init.method, headers });
}

describe("origin guard", () => {
  const app = panelApp(requireOrigin({ origin: "https://zsm3.pl" }));

  it("lets same-origin reads through", async ({ expect }) => {
    const passed = await request(app, { method: GET, origin: "https://zsm3.pl" });

    expect(passed.status).toBe(200);
    expect(await passed.text()).toBe("ok");
  });

  it("accepts exact same-origin JSON writes", async ({ expect }) => {
    const passed = await request(app, {
      method: POST,
      origin: "https://zsm3.pl",
      contentType: "application/json",
    });

    expect(passed.status).toBe(200);
  });

  it("rejects a missing or foreign origin with problem+json", async ({ expect }) => {
    for (const origin of [undefined, "https://inny.pl"]) {
      const rejected = await request(app, { method: GET, origin });
      expect(rejected.status).toBe(403);
      expect(rejected.headers.get("Content-Type")).toBe("application/problem+json");
      expect(await rejected.json()).toMatchObject({ title: "Forbidden", status: 403 });
    }
  });

  it("rejects writes whose content type is not exact JSON", async ({ expect }) => {
    for (const contentType of [undefined, "application/json; charset=utf-8", "text/plain"]) {
      const rejected = await request(app, {
        method: POST,
        origin: "https://zsm3.pl",
        contentType,
      });
      expect(rejected.status).toBe(403);
    }
  });
});
