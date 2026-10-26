import { describe, it } from "vitest";

import { NOW, submitBody, submitHarness, submitInput } from "./request-harness.ts";
import { requestStatus } from "../../src/requests/request-status.ts";
import { submitRequest } from "../../src/requests/submit.ts";
import { withdrawRequest } from "../../src/requests/withdraw.ts";

describe("requestStatus", () => {
  it("reports the status of a known token and hides unknown ones", async ({ expect }) => {
    const h = submitHarness();
    const outcome = await submitRequest(h.deps, submitInput(submitBody()));
    if (outcome.kind === "refused") {
      return expect.unreachable();
    }
    const token = outcome.statusUrl.split("#")[1] ?? "";

    expect(await requestStatus({ requests: h.requests }, { token })).toEqual({
      kind: "found",
      response: {
        type: "STUDENT_ID_RENEWAL",
        status: "submitted",
        updatedAt: NOW.toISOString(),
        collectionMessage: "",
      },
    });
    expect((await requestStatus({ requests: h.requests }, { token: "b".repeat(43) })).kind).toBe(
      "missing",
    );
    expect((await requestStatus({ requests: h.requests }, { token: "too-short" })).kind).toBe(
      "missing",
    );
    expect((await requestStatus({ requests: h.requests }, null)).kind).toBe("missing");
    expect((await requestStatus({ requests: h.requests }, { token: 5 })).kind).toBe("missing");
  });
});

describe("withdrawRequest", () => {
  it("reports a concurrent rejection instead of a successful withdrawal", async ({ expect }) => {
    const h = submitHarness();
    const outcome = await submitRequest(h.deps, submitInput(submitBody()));
    if (outcome.kind === "refused") return expect.unreachable();
    const token = outcome.statusUrl.split("#")[1] ?? "";
    const requests = {
      ...h.requests,
      withdrawAndErase: async (id: string) => h.requests.transition(id, "rejected"),
    };
    expect(await withdrawRequest({ requests, store: h.store }, { token })).toEqual({
      kind: "not_allowed",
    });
  });
  it("withdraws, erases pii and stays idempotent", async ({ expect }) => {
    const h = submitHarness();
    const outcome = await submitRequest(h.deps, submitInput(submitBody()));
    if (outcome.kind === "refused") {
      return expect.unreachable();
    }
    const token = outcome.statusUrl.split("#")[1] ?? "";
    const deps = { requests: h.requests, store: h.store };

    expect(await h.outbox.due(NOW.toISOString(), 10)).toHaveLength(2);

    expect(await withdrawRequest(deps, { token })).toEqual({ kind: "withdrawn" });
    expect(await h.outbox.due(NOW.toISOString(), 10)).toHaveLength(0);
    expect((await h.requests.list({ limit: 1 }))[0]).toMatchObject({
      status: "withdrawn",
      piiCiphertext: null,
      piiErasedAt: NOW.toISOString(),
    });
    expect(await withdrawRequest(deps, { token })).toEqual({ kind: "withdrawn" });
    expect((await withdrawRequest(deps, { token: "b".repeat(43) })).kind).toBe("missing");
    expect((await withdrawRequest(deps, null)).kind).toBe("missing");
  });

  it("refuses the withdrawal of a collected request", async ({ expect }) => {
    const h = submitHarness();
    const outcome = await submitRequest(h.deps, submitInput(submitBody()));
    if (outcome.kind === "refused") {
      return expect.unreachable();
    }
    const token = outcome.statusUrl.split("#")[1] ?? "";
    const id = (await h.requests.list({ limit: 1 }))[0]?.id ?? "";
    await h.requests.transition(id, "in_progress");
    await h.requests.transition(id, "ready");
    await h.requests.transition(id, "collected");

    expect(await withdrawRequest({ requests: h.requests, store: h.store }, { token })).toEqual({
      kind: "not_allowed",
    });
  });
});
