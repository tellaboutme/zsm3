import { env } from "cloudflare:workers";
import { beforeAll, describe, it } from "vitest";

import {
  ADMIN,
  jsonRequest,
  panelOnWorkerd,
  seedEncryptedRequest,
  sideEffects,
  type PanelOnWorkerd,
} from "./panel-requests-workers-support.ts";

let panel: PanelOnWorkerd;

function idFor(n: number): string {
  return `88888888-8888-4888-8888-${String(n).padStart(12, "0")}`;
}

async function move(
  id: string,
  who: "secretariat" | "admin",
  body: Readonly<Record<string, string>>,
): Promise<number> {
  const request = jsonRequest("POST", `/requests/${id}/status`, panel.tokens[who], body);
  return (await panel.app.fetch(request, env)).status;
}

describe("stale staff transitions on workerd", () => {
  beforeAll(async () => {
    panel = await panelOnWorkerd();
  });

  it("refuses a decision taken on a status another member already changed", async ({ expect }) => {
    const id = idFor(1);
    await seedEncryptedRequest(id);

    expect(await move(id, "admin", { to: "in_progress", expectedStatus: "submitted" })).toBe(200);
    expect(await move(id, "secretariat", { to: "rejected", expectedStatus: "submitted" })).toBe(
      409,
    );

    expect(await sideEffects(id)).toEqual({
      status: "in_progress",
      notices: [],
      actors: [ADMIN.email],
    });
  });

  it("refuses a transition that names no expected status", async ({ expect }) => {
    const id = idFor(2);
    await seedEncryptedRequest(id);
    expect(await move(id, "admin", { to: "in_progress", expectedStatus: "submitted" })).toBe(200);

    expect(await move(id, "secretariat", { to: "rejected" })).toBe(422);

    expect(await sideEffects(id)).toEqual({
      status: "in_progress",
      notices: [],
      actors: [ADMIN.email],
    });
  });

  it("lets exactly one of two concurrent decisions on the same status through", async ({
    expect,
  }) => {
    const id = idFor(3);
    await seedEncryptedRequest(id);
    await move(id, "admin", { to: "in_progress", expectedStatus: "submitted" });

    const statuses = await Promise.all([
      move(id, "admin", { to: "ready", expectedStatus: "in_progress" }),
      move(id, "secretariat", { to: "rejected", expectedStatus: "in_progress" }),
    ]);

    expect(statuses.toSorted((a, b) => a - b)).toEqual([200, 409]);
    const effects = await sideEffects(id);
    const won = statuses[0] === 200 ? "ready" : "rejected";
    expect(effects.status).toBe(won);
    expect(effects.notices).toEqual([won === "ready" ? "READY_NOTICE" : "REJECTED_NOTICE"]);
    expect(effects.actors).toHaveLength(2);
  });

  it("refuses the stale decision even when the change kept the same timestamp", async ({
    expect,
  }) => {
    const id = idFor(4);
    await seedEncryptedRequest(id);
    const seen = await env.DB.prepare("SELECT updated_at FROM requests WHERE id = ?")
      .bind(id)
      .first<{ updated_at: string }>();

    expect(await move(id, "admin", { to: "in_progress", expectedStatus: "submitted" })).toBe(200);
    await env.DB.prepare("UPDATE requests SET updated_at = ?1 WHERE id = ?2")
      .bind(seen?.updated_at ?? "", id)
      .run();

    expect(await move(id, "secretariat", { to: "rejected", expectedStatus: "submitted" })).toBe(
      409,
    );
    expect(await sideEffects(id)).toEqual({
      status: "in_progress",
      notices: [],
      actors: [ADMIN.email],
    });
  });
});
