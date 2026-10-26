import { describe, it } from "vitest";

import { NOW, submitBody, submitHarness, submitInput } from "./request-harness.ts";
import { submitRequest } from "../../src/requests/submit.ts";
import { requestsRepo } from "../../src/storage/requests-repo.ts";

describe("submitRequest outbox failures", () => {
  it("rolls back the request and first message when the second message fails", async ({
    expect,
  }) => {
    const h = submitHarness();
    await h.store.db
      .prepare(
        `CREATE TRIGGER fail_second_mail BEFORE INSERT ON email_outbox
      WHEN NEW.kind = 'SECRETARIAT_NOTICE' BEGIN SELECT RAISE(ABORT, 'mail failure'); END`,
      )
      .run();

    await expect(submitRequest(h.deps, submitInput(submitBody()))).rejects.toThrow("mail failure");
    expect(await h.requests.list({ limit: 10 })).toHaveLength(0);
    expect(await h.outbox.due(NOW.toISOString(), 10)).toHaveLength(0);
    expect(await h.requests.countOpenByEmailIndex(new Uint8Array(32))).toBe(0);
  });

  it("propagates a batch failure", async ({ expect }) => {
    const h = submitHarness();
    const requests = requestsRepo({
      ...h.store,
      db: { ...h.store.db, batch: async () => Promise.reject(new Error("storage unavailable")) },
    });

    await expect(submitRequest({ ...h.deps, requests }, submitInput(submitBody()))).rejects.toThrow(
      "storage unavailable",
    );
    expect(await h.requests.list({ limit: 10 })).toHaveLength(0);
  });

  it("propagates a form key conflict if its row disappears before lookup", async ({ expect }) => {
    const h = submitHarness();
    const body = submitBody();
    await submitRequest(h.deps, submitInput(body));
    const requests = requestsRepo({
      ...h.store,
      db: {
        ...h.store.db,
        prepare: (query) => {
          const statement = h.store.db.prepare(query);
          if (query.includes("WHERE form_key = ?")) {
            return {
              ...statement,
              bind: (...values) => ({
                ...statement.bind(...values),
                first: async () => Promise.resolve(null),
              }),
            };
          }
          return statement;
        },
      },
    });

    await expect(submitRequest({ ...h.deps, requests }, submitInput(body))).rejects.toThrow(
      "UNIQUE constraint failed: requests.form_key",
    );
    expect(await h.outbox.due(NOW.toISOString(), 10)).toHaveLength(2);
  });
});
