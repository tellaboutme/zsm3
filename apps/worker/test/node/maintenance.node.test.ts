import { describe, it } from "vitest";

import { harness, NOW, setStatus } from "./maintenance-harness.ts";
import { runMaintenance, type MaintenanceDeps } from "../../src/jobs/retention.ts";
import { EmailDeliveryError } from "../../src/mail/email-sender.ts";
import { requestsRepo } from "../../src/storage/requests-repo.ts";

describe("runMaintenance", () => {
  it("rolls back the inactive transition when the D1 batch fails and retries only once", async ({
    expect,
  }) => {
    const h = harness();
    await h.add("stale-open");
    await setStatus(h, {
      id: "stale-open",
      status: "submitted",
      updatedAt: "2020-01-01T00:00:00Z",
      closedAt: null,
    });
    const failing = requestsRepo({
      ...h.store,
      db: {
        prepare: (sql) => h.store.db.prepare(sql),
        batch: async (statements) => {
          await h.store.db.batch([
            ...statements,
            h.store.db.prepare("INSERT INTO absent_table VALUES (1)"),
          ]);
          return [];
        },
      },
    });
    await expect(runMaintenance({ ...h.deps, requests: failing }, NOW)).rejects.toThrow();
    expect(await h.requests.findById("stale-open")).toMatchObject({ status: "submitted" });
    expect(await h.outbox.due(NOW.toISOString(), 10)).toHaveLength(0);
    expect((await runMaintenance(h.deps, NOW)).rejected).toBe(1);
    expect(await h.outbox.due(NOW.toISOString(), 10)).toHaveLength(1);
    expect((await runMaintenance(h.deps, NOW)).rejected).toBe(0);
  });
  it("drains the outbox and applies every retention action", async ({ expect }) => {
    const h = harness();
    await h.add("stale-open");
    await setStatus(h, {
      id: "stale-open",
      status: "submitted",
      updatedAt: "2020-01-01T00:00:00Z",
      closedAt: null,
    });
    await h.add("old-closed");
    await setStatus(h, {
      id: "old-closed",
      status: "collected",
      updatedAt: "2026-09-01T08:00:00Z",
      closedAt: "2026-09-01T08:00:00Z",
    });
    await h.outbox.enqueue([{ kind: "READY_NOTICE", requestId: "old-closed", origin: null }]);
    await h.store.db
      .prepare("UPDATE email_outbox SET next_attempt_at = ? WHERE request_id = ?")
      .bind("2026-10-23T08:00:00Z", "old-closed")
      .run();
    await h.store.db
      .prepare(
        "INSERT INTO outbox_failures (id, message_kind, request_id, error_code, at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind("old-failure", "READY_NOTICE", "old-closed", "test", "2026-09-01T08:00:00Z")
      .run();
    await h.add("fresh-closed");
    await setStatus(h, {
      id: "fresh-closed",
      status: "collected",
      updatedAt: "2026-10-20T08:00:00Z",
      closedAt: "2026-10-20T08:00:00Z",
    });
    await h.add("withdrawn");
    await setStatus(h, {
      id: "withdrawn",
      status: "withdrawn",
      updatedAt: "2026-09-01T08:00:00Z",
      closedAt: "2026-09-01T08:00:00Z",
    });
    await h.add("anonymous-old");
    await h.requests.erasePii("anonymous-old", "2020-01-01T00:00:00Z");
    await h.add("anonymous-fresh");
    await h.requests.erasePii("anonymous-fresh", "2026-10-21T00:00:00Z");
    await h.outbox.enqueue([
      { kind: "SUBMISSION_CONFIRMATION", requestId: "fresh-closed", origin: "https://zsm3.test" },
    ]);

    const result = await runMaintenance(h.deps, NOW);

    expect(result).toEqual({
      sent: 1,
      retried: 0,
      deadLettered: 0,
      rejected: 1,
      erased: 2,
      deleted: 1,
    });
    expect(await h.requests.findById("stale-open")).toMatchObject({ status: "rejected" });
    expect(await h.requests.findById("old-closed")).toMatchObject({
      piiErasedAt: NOW.toISOString(),
    });
    expect(
      (
        await h.store.db
          .prepare("SELECT id FROM outbox_failures WHERE request_id = ?")
          .bind("old-closed")
          .all()
      ).results,
    ).toHaveLength(0);
    expect(await h.requests.findById("withdrawn")).toMatchObject({
      piiErasedAt: NOW.toISOString(),
    });
    expect(await h.requests.findById("anonymous-old")).toBeUndefined();
    expect(await h.requests.findById("fresh-closed")).toMatchObject({ piiErasedAt: null });
    const notices = await h.outbox.due(NOW.toISOString(), 10);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      kind: "REJECTED_NOTICE",
      requestId: "stale-open",
      origin: null,
    });
  });

  it("keeps applying retention while the email provider is down", async ({ expect }) => {
    const h = harness();
    await h.add("stale-open");
    await setStatus(h, {
      id: "stale-open",
      status: "submitted",
      updatedAt: "2020-01-01T00:00:00Z",
      closedAt: null,
    });
    await h.add("fresh-closed");
    await setStatus(h, {
      id: "fresh-closed",
      status: "collected",
      updatedAt: "2026-10-20T08:00:00Z",
      closedAt: "2026-10-20T08:00:00Z",
    });
    await h.outbox.enqueue([
      { kind: "SUBMISSION_CONFIRMATION", requestId: "fresh-closed", origin: "https://zsm3.test" },
    ]);
    const failing: MaintenanceDeps = {
      ...h.deps,
      sender: {
        send: async () => Promise.reject(new EmailDeliveryError("brevo_status_500")),
      },
    };

    const result = await runMaintenance(failing, NOW);

    expect(result).toEqual({
      sent: 0,
      retried: 1,
      deadLettered: 0,
      rejected: 1,
      erased: 0,
      deleted: 0,
    });
    expect(await h.requests.findById("stale-open")).toMatchObject({ status: "rejected" });
  });
});
