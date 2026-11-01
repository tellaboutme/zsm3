import { panelRequestDetailSchema, type PanelRequestDetail } from "@zsm3/contracts/requests";
import { describe, expect, it } from "vitest";

import { ADMIN, EDITOR, SECRETARIAT, seedRequest } from "./panel-requests-support.ts";
import {
  expectProblem,
  panelHarness,
  panelJsonCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";

describe("panel requests detail", () => {
  it("decrypts personal data for secretariat staff only", async () => {
    const harness = await panelHarness();
    await seedStaff(harness.env, [SECRETARIAT, EDITOR]);
    const token = await harness.keys.sign(staffClaims(SECRETARIAT.email));
    const editorToken = await harness.keys.sign(staffClaims(EDITOR.email));

    const id = "33333333-3333-4333-8333-333333333333";
    await seedRequest(harness.env, id);

    const res = await panelJsonCall(harness, "GET", `/requests/${id}`, { token });
    expect(res.status).toBe(200);
    const detail: PanelRequestDetail = panelRequestDetailSchema.parse(await res.json());
    expect(detail).toMatchObject({
      id,
      firstName: "Jan",
      lastName: "Kowalski",
      className: "4ta",
      graduationYear: null,
      email: "jan.kowalski@zsm3.test",
      note: "Prosze o szybkie wydanie",
      piiErasedAt: null,
    });

    await expectProblem(
      await panelJsonCall(harness, "GET", `/requests/${id}`, { token: editorToken }),
      403,
    );
    await expectProblem(
      await panelJsonCall(harness, "GET", "/requests/99999999-9999-4999-8999-999999999999", {
        token,
      }),
      404,
    );
    await expectProblem(
      await panelJsonCall(harness, "GET", "/requests/not-a-uuid", { token }),
      404,
    );
    await expectProblem(
      await panelJsonCall(harness, "GET", `/requests/${id}`, { token: "invalid" }),
      401,
    );
  });

  it("returns null personal fields after retention erased the record", async () => {
    const harness = await panelHarness();
    await seedStaff(harness.env, [ADMIN]);
    const token = await harness.keys.sign(staffClaims(ADMIN.email));

    const id = "44444444-4444-4444-8444-444444444444";
    await seedRequest(harness.env, id, { erasedAt: "2026-10-25T08:00:00.000Z" });

    const res = await panelJsonCall(harness, "GET", `/requests/${id}`, { token });
    expect(res.status).toBe(200);
    const detail: PanelRequestDetail = panelRequestDetailSchema.parse(await res.json());
    expect(detail).toMatchObject({
      id,
      firstName: null,
      lastName: null,
      className: null,
      graduationYear: null,
      email: null,
      note: null,
      piiErasedAt: "2026-10-25T08:00:00.000Z",
    });
  });
});
