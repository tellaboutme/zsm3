import { describe, expect, it, vi } from "vitest";

import { SECRETARIAT, outboxFor, seedRequest, storedStatus } from "./panel-requests-support.ts";
import {
  expectProblem,
  panelAudit,
  panelHarness,
  panelJsonCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";

const ID = "77777777-7777-4777-8777-777777777777";

async function secretariatHarness() {
  const harness = await panelHarness();
  await seedStaff(harness.env, [SECRETARIAT]);
  const token = await harness.keys.sign(staffClaims(SECRETARIAT.email));
  await seedRequest(harness.env, ID, { status: "in_progress" });
  const move = async (to: string, expectedStatus = "in_progress") =>
    panelJsonCall(harness, "POST", `/requests/${ID}/status`, {
      token,
      body: { to, expectedStatus },
    });
  return { harness, move };
}

describe("panel request transitions under contention", () => {
  it.each(["withdrawn", "submitted"])("refuses the applicant-only target %s", async (to) => {
    const { harness, move } = await secretariatHarness();

    await expectProblem(await move(to), 422);

    expect(await storedStatus(harness.env, ID)).toMatchObject({ status: "in_progress" });
    expect(await panelAudit(harness.env).byEntity("requests", ID, 10)).toHaveLength(0);
  });

  it.each([
    ["rejected", "submitted"],
    ["ready", "submitted"],
    ["ready", "ready"],
  ])("refuses %s decided on a stale %s with 409 and no side effects", async (to, expected) => {
    const { harness, move } = await secretariatHarness();

    const problem = await expectProblem(await move(to, expected), 409);

    expect(problem.title).toBe("Request Status Changed");
    expect(await storedStatus(harness.env, ID)).toMatchObject({ status: "in_progress" });
    expect(await outboxFor(harness.env, ID)).toHaveLength(0);
    expect(await panelAudit(harness.env).byEntity("requests", ID, 10)).toHaveLength(0);
  });

  it("answers 409 without audit or notice when the applicant withdrew in between", async () => {
    const { harness, move } = await secretariatHarness();
    const db = harness.env.DB;
    const batch = db.batch.bind(db);
    vi.spyOn(db, "batch").mockImplementationOnce(async (statements) => {
      await db
        .prepare("UPDATE requests SET status = 'withdrawn', updated_at = ?1 WHERE id = ?2")
        .bind("2026-10-22T09:00:00.000Z", ID)
        .run();
      return batch(statements);
    });

    const problem = await expectProblem(await move("ready"), 409);

    expect(problem.title).toBe("Request Status Changed");
    expect(await storedStatus(harness.env, ID)).toMatchObject({ status: "withdrawn" });
    expect(await outboxFor(harness.env, ID)).toHaveLength(0);
    expect(await panelAudit(harness.env).byEntity("requests", ID, 10)).toHaveLength(0);
  });
});
