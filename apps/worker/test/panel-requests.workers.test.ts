import { panelRequestsListSchema } from "@zsm3/contracts/panel-requests";
import { panelRequestDetailSchema, type PanelRequestDetail } from "@zsm3/contracts/requests";
import { env } from "cloudflare:workers";
import { beforeAll, describe, it } from "vitest";

import {
  SECRETARIAT,
  jsonRequest,
  panelOnWorkerd,
  seedEncryptedRequest,
  sideEffects,
  type PanelOnWorkerd,
} from "./panel-requests-workers-support.ts";

let panel: PanelOnWorkerd;

describe("panel requests API on workerd", () => {
  beforeAll(async () => {
    panel = await panelOnWorkerd();
  });

  it("lists, views and transitions requests on workerd", async ({ expect }) => {
    const { app, tokens } = panel;
    const token = tokens.secretariat;
    const id = "77777777-7777-4777-8777-777777777777";
    await seedEncryptedRequest(id);

    expect((await app.fetch(jsonRequest("GET", "/requests"), env)).status).toBe(401);

    const listRes = await app.fetch(jsonRequest("GET", "/requests", token), env);
    expect(listRes.status).toBe(200);
    const list = panelRequestsListSchema.parse(await listRes.json());
    expect(list.items.map((item) => item.id)).toEqual([id]);

    const getRes = await app.fetch(jsonRequest("GET", `/requests/${id}`, token), env);
    expect(getRes.status).toBe(200);
    const detail: PanelRequestDetail = panelRequestDetailSchema.parse(await getRes.json());
    expect(detail).toMatchObject({
      firstName: "Jan",
      lastName: "Kowalski",
      email: "jan.kowalski@zsm3.test",
    });

    const editorGet = jsonRequest("GET", `/requests/${id}`, tokens.editor);
    expect((await app.fetch(editorGet, env)).status).toBe(403);

    const ready = await app.fetch(
      jsonRequest("POST", `/requests/${id}/status`, token, {
        to: "ready",
        expectedStatus: "submitted",
      }),
      env,
    );
    expect(ready.status).toBe(422);

    for (const [expectedStatus, to] of [
      ["submitted", "in_progress"],
      ["in_progress", "ready"],
    ] as const) {
      const response = await app.fetch(
        jsonRequest("POST", `/requests/${id}/status`, token, { to, expectedStatus }),
        env,
      );
      expect(response.status).toBe(200);
    }

    const effects = await sideEffects(id);
    expect(effects).toEqual({
      status: "ready",
      notices: ["READY_NOTICE"],
      actors: [SECRETARIAT.email, SECRETARIAT.email],
    });
    const audits = await env.DB.prepare("SELECT details_json FROM audit_log WHERE entity_id = ?")
      .bind(id)
      .all();
    expect(JSON.stringify(audits.results)).not.toMatch(/Jan|Kowalski|jan\.kowalski/u);
  });
});
