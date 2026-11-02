import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  EDITOR,
  SECRETARIAT,
  outboxFor,
  seedRequest,
  storedStatus,
} from "./panel-requests-support.ts";
import {
  expectProblem,
  panelAudit,
  panelHarness,
  panelJsonCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";

const auditDetailsSchema = z.object({ fields: z.array(z.string()) });
const outboxKindSchema = z.object({ kind: z.string(), origin: z.string().nullable() });

describe("panel requests transitions", () => {
  it("moves a request through the state machine and audits every step", async () => {
    const harness = await panelHarness();
    await seedStaff(harness.env, [SECRETARIAT]);
    const token = await harness.keys.sign(staffClaims(SECRETARIAT.email));

    const id = "55555555-5555-4555-8555-555555555555";
    await seedRequest(harness.env, id);

    const toInProgress = await panelJsonCall(harness, "POST", `/requests/${id}/status`, {
      token,
      body: { to: "in_progress", expectedStatus: "submitted" },
    });
    expect(toInProgress.status).toBe(200);
    expect(await toInProgress.json()).toEqual({ ok: true });
    expect(await outboxFor(harness.env, id)).toHaveLength(0);

    const toReady = await panelJsonCall(harness, "POST", `/requests/${id}/status`, {
      token,
      body: { to: "ready", expectedStatus: "in_progress" },
    });
    expect(toReady.status).toBe(200);
    expect(await storedStatus(harness.env, id)).toMatchObject({ status: "ready", closed_at: null });
    const readyOutbox = await outboxFor(harness.env, id);
    expect(readyOutbox.map((row) => outboxKindSchema.parse(row).kind)).toEqual(["READY_NOTICE"]);
    expect(outboxKindSchema.parse(readyOutbox[0]).origin).toBe("https://panel.zsm3.test");

    const toCollected = await panelJsonCall(harness, "POST", `/requests/${id}/status`, {
      token,
      body: { to: "collected", expectedStatus: "ready" },
    });
    expect(toCollected.status).toBe(200);
    const stored = z
      .object({ status: z.string(), updated_at: z.string(), closed_at: z.string().nullable() })
      .parse(await storedStatus(harness.env, id));
    expect(stored.status).toBe("collected");
    expect(stored.closed_at).toBe(stored.updated_at);

    const audits = await panelAudit(harness.env).byEntity("requests", id, 10);
    expect(audits).toHaveLength(3);
    for (const audit of audits) {
      expect(audit.action).toBe("requests.transition");
      expect(audit.actorEmail).toBe(SECRETARIAT.email);
      expect(auditDetailsSchema.parse(JSON.parse(audit.details)).fields).toEqual(["status"]);
    }

    await expectProblem(
      await panelJsonCall(harness, "POST", `/requests/${id}/status`, {
        token,
        body: { to: "ready", expectedStatus: "collected" },
      }),
      422,
    );
  });

  it("queues the rejection notice and validates the request", async () => {
    const harness = await panelHarness();
    await seedStaff(harness.env, [SECRETARIAT, EDITOR]);
    const token = await harness.keys.sign(staffClaims(SECRETARIAT.email));
    const editorToken = await harness.keys.sign(staffClaims(EDITOR.email));

    const id = "66666666-6666-4666-8666-666666666666";
    await seedRequest(harness.env, id);

    const rejected = await panelJsonCall(harness, "POST", `/requests/${id}/status`, {
      token,
      body: { to: "rejected", expectedStatus: "submitted" },
    });
    expect(rejected.status).toBe(200);
    const kinds = (await outboxFor(harness.env, id)).map((row) => outboxKindSchema.parse(row).kind);
    expect(kinds).toEqual(["REJECTED_NOTICE"]);
    expect(await storedStatus(harness.env, id)).toMatchObject({ status: "rejected" });

    await expectProblem(
      await panelJsonCall(harness, "POST", "/requests/invalid-uuid/status", {
        token,
        body: { to: "in_progress", expectedStatus: "submitted" },
      }),
      404,
    );
    await expectProblem(
      await panelJsonCall(
        harness,
        "POST",
        "/requests/88888888-8888-4888-8888-888888888888/status",
        { token, body: { to: "in_progress", expectedStatus: "submitted" } },
      ),
      404,
    );
    await expectProblem(
      await panelJsonCall(harness, "POST", `/requests/${id}/status`, {
        token,
        body: { to: "invalid_status", expectedStatus: "submitted" },
      }),
      422,
    );
    await expectProblem(
      await panelJsonCall(harness, "POST", `/requests/${id}/status`, {
        token: editorToken,
        body: { to: "ready", expectedStatus: "submitted" },
      }),
      403,
    );
  });
});
