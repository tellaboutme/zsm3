import { requestPiiSchema, type RequestPii } from "@zsm3/contracts/requests";
import { describe, it } from "vitest";

import {
  NOW,
  ORIGIN,
  submitBody,
  submitHarness,
  submitInput,
  type SubmitHarness,
} from "./request-harness.ts";
import { statusLink, submitRequest, type SubmitOutcome } from "../../src/requests/submit.ts";
import { emailIndex, piiCrypto } from "../../src/security/pii-crypto.ts";

const IP = "203.0.113.10";

async function decryptPii(h: SubmitHarness, id: string): Promise<RequestPii> {
  const record = await h.requests.findById(id);
  const crypto = piiCrypto(h.config.piiKeys, h.config.activePiiKeyId, h.store.random);
  return requestPiiSchema.parse(
    JSON.parse(
      await crypto.decrypt(record?.piiCiphertext ?? new Uint8Array(), record?.piiKeyId ?? "", id),
    ),
  );
}

describe("submitRequest", () => {
  it("creates a request, stores encrypted pii and enqueues two confirmations", async ({
    expect,
  }) => {
    const h = submitHarness();
    const body = submitBody({ email: "  Jan.Przykladowy@Example.COM " });

    const outcome = await submitRequest(h.deps, submitInput(body, ORIGIN, IP));

    expect(outcome.kind).toBe("created");
    if (outcome.kind === "refused") {
      return expect.unreachable();
    }
    expect(outcome.statusUrl).toMatch(/^https:\/\/zsm3\.test\/e-wniosek\/status#[\w-]{43}$/u);
    expect(await h.outbox.due(NOW.toISOString(), 10)).toHaveLength(2);
    const record = (await h.requests.list({ limit: 1 }))[0];
    expect(record).toMatchObject({ status: "submitted", piiKeyId: "PRIMARY" });
    expect(
      await h.requests.countOpenByEmailIndex(
        await emailIndex(h.config.emailIndexKey, "jan.przykladowy@example.com"),
      ),
    ).toBe(1);
    const pii = await decryptPii(h, record?.id ?? "");
    expect(pii).toMatchObject({
      firstName: "Jan",
      email: "jan.przykladowy@example.com",
      className: "4tp",
    });
    expect(outcome.statusUrl.endsWith(`#${pii.statusToken}`)).toBe(true);
  });

  it("stores a graduation year only for the certificate type", async ({ expect }) => {
    const h = submitHarness();
    await submitRequest(
      h.deps,
      submitInput(
        submitBody({ type: "ENROLLMENT_CERTIFICATE", graduationYear: 2024, className: undefined }),
      ),
    );
    const record = (await h.requests.list({ limit: 1 }))[0];
    const pii = await decryptPii(h, record?.id ?? "");
    expect(pii.graduationYear).toBe(2024);
    expect(pii.className).toBeUndefined();
  });

  it("stores an optional note in the encrypted personal data", async ({ expect }) => {
    const h = submitHarness();
    await submitRequest(h.deps, submitInput(submitBody({ note: "  Proszę o kontakt.  " })));
    const record = (await h.requests.list({ limit: 1 }))[0];

    expect((await decryptPii(h, record?.id ?? "")).note).toBe("Proszę o kontakt.");
  });

  it("does not disclose the status token on a duplicate submit", async ({ expect }) => {
    const h = submitHarness();
    const body = submitBody();
    const first = await submitRequest(h.deps, submitInput(body));
    const second = await submitRequest(h.deps, submitInput(body));

    expect(second.kind).toBe("duplicate");
    if (first.kind === "refused" || second.kind === "refused") {
      return expect.unreachable();
    }
    expect(second.statusUrl).toBe(statusLink(ORIGIN, undefined));
    expect(second.statusUrl).not.toBe(first.statusUrl);
    expect(await h.outbox.due(NOW.toISOString(), 10)).toHaveLength(2);
  });

  it("refuses a duplicate when the pii and email index are gone", async ({ expect }) => {
    const h = submitHarness();
    const body = submitBody();
    await submitRequest(h.deps, submitInput(body));
    const record = (await h.requests.list({ limit: 1 }))[0];
    await h.requests.erasePii(record?.id ?? "", NOW.toISOString());

    expect(await submitRequest(h.deps, submitInput(body))).toEqual({
      kind: "refused",
      reason: "invalid",
    });
  });

  it("refuses the same form key from another email without revealing the status link", async ({
    expect,
  }) => {
    const h = submitHarness();
    const body = submitBody();
    const first = await submitRequest(h.deps, submitInput(body));
    const second = await submitRequest(
      h.deps,
      submitInput({ ...body, email: "other@example.com" }),
    );

    expect(first.kind).toBe("created");
    expect(second).toEqual({ kind: "refused", reason: "invalid" });
    expect(await h.requests.list({ limit: 10 })).toHaveLength(1);
    expect(await h.outbox.due(NOW.toISOString(), 10)).toHaveLength(2);
  });

  it("answers a duplicate without a token when the pii cannot be decrypted", async ({ expect }) => {
    const h = submitHarness();
    const body = submitBody();
    await submitRequest(h.deps, submitInput(body));
    const record = (await h.requests.list({ limit: 1 }))[0];
    await h.store.db
      .prepare("UPDATE requests SET pii_ciphertext = ?1 WHERE id = ?2")
      .bind(new Uint8Array([9, 9, 9]), record?.id ?? "")
      .run();

    expect(await submitRequest(h.deps, submitInput(body))).toEqual({
      kind: "duplicate",
      statusUrl: statusLink(ORIGIN, undefined),
    });
  });

  it("refuses the sixth submit of one ip within the window", async ({ expect }) => {
    const h = submitHarness();
    const outcomes: SubmitOutcome[] = [];
    for (let index = 0; index < 6; index += 1) {
      outcomes.push(
        await submitRequest(
          h.deps,
          submitInput(submitBody({ email: `pupil${String(index)}@example.com` }), ORIGIN, IP),
        ),
      );
    }

    expect(outcomes.slice(0, 5).every((outcome) => outcome.kind === "created")).toBe(true);
    expect(outcomes[5]).toEqual({ kind: "refused", reason: "rate_limit" });
  });

  it("refuses a failed or foreign-hostname turnstile challenge", async ({ expect }) => {
    const h = submitHarness();

    expect(await submitRequest(h.deps, submitInput(submitBody(), "https://evil.test", IP))).toEqual(
      {
        kind: "refused",
        reason: "turnstile",
      },
    );
    expect(
      await submitRequest(h.deps, submitInput({ email: "jan@example.com" }, ORIGIN, IP)),
    ).toEqual({ kind: "refused", reason: "invalid" });
  });

  it("refuses garbage, bots in a hurry and too many open requests", async ({ expect }) => {
    const h = submitHarness();

    expect(await submitRequest(h.deps, submitInput(null))).toEqual({
      kind: "refused",
      reason: "invalid",
    });
    expect(
      await submitRequest(h.deps, submitInput(submitBody({ submittedAtMs: NOW.getTime() - 100 }))),
    ).toEqual({ kind: "refused", reason: "trap" });
    expect(
      await submitRequest(h.deps, submitInput(submitBody({ submittedAtMs: NOW.getTime() + 5000 }))),
    ).toEqual({ kind: "refused", reason: "trap" });
    for (let index = 0; index < 3; index += 1) {
      await submitRequest(
        h.deps,
        submitInput(submitBody({ formKey: crypto.randomUUID() }), ORIGIN, IP),
      );
    }
    expect(
      await submitRequest(
        h.deps,
        submitInput(submitBody({ formKey: crypto.randomUUID() }), ORIGIN, IP),
      ),
    ).toEqual({ kind: "refused", reason: "open_limit" });
    expect(await h.requests.list({ limit: 10 })).toHaveLength(3);
  });
});
