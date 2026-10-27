import { describe, it } from "vitest";

import { NOW, ORIGIN, submitBody, submitHarness, submitInput } from "./request-harness.ts";
import { statusLink, submitRequest } from "../../src/requests/submit.ts";

describe("request duplicates", () => {
  it("refuses a duplicate with a malformed email index", async ({ expect }) => {
    const h = submitHarness();
    const key = crypto.randomUUID();
    const body = submitBody({ formKey: key });
    await submitRequest(h.deps, submitInput(body));
    await h.store.db
      .prepare("UPDATE requests SET email_index = ? WHERE form_key = ?")
      .bind(new Uint8Array([1]), key)
      .run();

    expect(await submitRequest(h.deps, submitInput(body))).toEqual({
      kind: "refused",
      reason: "invalid",
    });
  });

  it("returns a duplicate at the limit without new messages", async ({ expect }) => {
    const h = submitHarness();
    const firstBody = submitBody();
    await submitRequest(h.deps, submitInput(firstBody));
    await submitRequest(h.deps, submitInput(submitBody()));
    await submitRequest(h.deps, submitInput(submitBody()));

    expect(await submitRequest(h.deps, submitInput(firstBody))).toEqual({
      kind: "duplicate",
      statusUrl: statusLink(ORIGIN, undefined),
    });
    expect(await h.outbox.due(NOW.toISOString(), 10)).toHaveLength(6);
  });

  it("returns a duplicate without a token when pii is erased but its index remains", async ({
    expect,
  }) => {
    const h = submitHarness();
    const key = crypto.randomUUID();
    const body = submitBody({ formKey: key });
    await submitRequest(h.deps, submitInput(body));
    await h.store.db
      .prepare(
        "UPDATE requests SET pii_ciphertext = NULL, pii_key_id = NULL, pii_erased_at = ? WHERE form_key = ?",
      )
      .bind(NOW.toISOString(), key)
      .run();

    expect(await submitRequest(h.deps, submitInput(body))).toEqual({
      kind: "duplicate",
      statusUrl: statusLink(ORIGIN, undefined),
    });
  });
});
