import { describe, it, vi } from "vitest";

import {
  AFTER_EXPIRY,
  CLEAN,
  failingOn,
  leftovers,
  scene,
  withoutSecrets,
  withSecrets,
} from "./maintenance-housekeeping-support.ts";
import { MissingSecretError } from "../../src/env.ts";
import { HousekeepingError } from "../../src/jobs/housekeeping.ts";
import { runScheduledMaintenance } from "../../src/jobs/retention.ts";
import { RATE_LIMIT_RETENTION_MS } from "../../src/storage/rate-limits-repo.ts";

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

describe("scheduled housekeeping", () => {
  it("cleans private files, uploads, links and counters without e-wniosek secrets", async ({
    expect,
  }) => {
    const current = await scene();

    await expect(
      runScheduledMaintenance(withoutSecrets(current), current.store, AFTER_EXPIRY),
    ).rejects.toThrow(MissingSecretError);
    await expect(leftovers(current)).resolves.toEqual(CLEAN);
  });

  it("cleans the same way with valid secrets and keeps the e-wniosek result", async ({
    expect,
  }) => {
    const current = await scene();

    await expect(
      runScheduledMaintenance(withSecrets(current), current.store, AFTER_EXPIRY),
    ).resolves.toMatchObject({ sent: 0, erased: 0, auditDeleted: 0 });
    await expect(leftovers(current)).resolves.toEqual(CLEAN);
  });

  it("is a no-op when the cron runs again", async ({ expect }) => {
    const current = await scene();
    const env = withSecrets(current);
    await runScheduledMaintenance(env, current.store, AFTER_EXPIRY);
    const deleted = current.bucket.deleted.length;

    await expect(runScheduledMaintenance(env, current.store, AFTER_EXPIRY)).resolves.toBeDefined();
    await expect(leftovers(current)).resolves.toEqual(CLEAN);
    expect(current.bucket.deleted).toHaveLength(deleted);
  });

  it("runs the other steps when one D1 step fails, and reports the failure", async ({ expect }) => {
    const current = await scene();
    const errors = quietErrors();
    const broken = { ...current.store, db: failingOn(current.store.db, "DELETE FROM rate_limits") };

    await expect(
      runScheduledMaintenance(withSecrets(current), broken, AFTER_EXPIRY),
    ).rejects.toThrow(new HousekeepingError(["rate_limits"]));
    expect(errors.mock.calls).toEqual([
      [
        JSON.stringify({
          event: "housekeeping_step_failed",
          step: "rate_limits",
          errorName: "Error",
        }),
      ],
    ]);
    errors.mockRestore();
    await expect(leftovers(current)).resolves.toEqual({ ...CLEAN, rate_limits: 1 });

    await runScheduledMaintenance(withSecrets(current), current.store, AFTER_EXPIRY);
    await expect(leftovers(current)).resolves.toEqual(CLEAN);
  });

  it("keeps files for the next run when R2 fails, without naming them", async ({ expect }) => {
    const current = await scene();
    const errors = quietErrors();
    const r2Down = { ...current.bucket, delete: async () => Promise.reject(new TypeError("down")) };

    await expect(
      runScheduledMaintenance(withSecrets(current, r2Down), current.store, AFTER_EXPIRY),
    ).rejects.toThrow(HousekeepingError);
    expect(errors.mock.calls).toEqual([
      [
        JSON.stringify({
          event: "housekeeping_step_failed",
          step: "short_link_files",
          errorName: "TypeError",
        }),
      ],
    ]);
    errors.mockRestore();
    await expect(leftovers(current)).resolves.toMatchObject({ rate_limits: 0, objects: 3 });

    await runScheduledMaintenance(withSecrets(current), current.store, AFTER_EXPIRY);
    await expect(leftovers(current)).resolves.toEqual(CLEAN);
  });

  it("names a thrown value that is not an error", async ({ expect }) => {
    const current = await scene();
    const errors = quietErrors();
    const strange = {
      ...current.bucket,
      delete: vi.fn<(key: string) => Promise<void>>().mockRejectedValue(7),
    };

    await expect(
      runScheduledMaintenance(withSecrets(current, strange), current.store, AFTER_EXPIRY),
    ).rejects.toThrow("short_link_files");
    expect(errors).toHaveBeenCalledWith(
      JSON.stringify({
        event: "housekeeping_step_failed",
        step: "short_link_files",
        errorName: "UnknownError",
      }),
    );
    errors.mockRestore();
  });
});

describe("the housekeeping failure", () => {
  it("names every failed step and nothing else", ({ expect }) => {
    const error = new HousekeepingError(["rate_limits", "short_link_files"]);

    expect([error.name, error.message, error.steps]).toEqual([
      "HousekeepingError",
      "Housekeeping steps failed: rate_limits, short_link_files",
      ["rate_limits", "short_link_files"],
    ]);
    expect(RATE_LIMIT_RETENTION_MS).toBe(86_400_000);
  });
});
