import { afterEach, describe, it, vi } from "vitest";

import { cleanupFixture, fakeBucket, HASH, START } from "./photo-cleanup-support.ts";
import { ABANDONED_UPLOAD_MS, runLoggedPhotoCleanup } from "../../src/jobs/photo-cleanup.ts";

const AFTER_GRACE = new Date(START.getTime() + ABANDONED_UPLOAD_MS + 1);

function failedStep(errorName: string): readonly string[] {
  return [JSON.stringify({ event: "housekeeping_step_failed", step: "photo_cleanup", errorName })];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logged photo cleanup", () => {
  it("returns the result and logs nothing when the cleanup works", async ({ expect }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fixture = cleanupFixture();
    await fixture.uploads.begin(HASH);
    expect(await runLoggedPhotoCleanup(fakeBucket([HASH]), fixture.store, AFTER_GRACE)).toBe(1);
    expect(logged).not.toHaveBeenCalled();
  });

  it("names the step and passes the failure on", async ({ expect }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fixture = cleanupFixture();
    await fixture.uploads.begin(HASH);
    const bucket = fakeBucket([HASH]);
    bucket.failNext();
    await expect(runLoggedPhotoCleanup(bucket, fixture.store, AFTER_GRACE)).rejects.toThrow(
      "R2 unavailable",
    );
    expect(logged.mock.calls).toEqual([failedStep("Error")]);
  });

  it("logs a failure that is not an Error", async ({ expect }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fixture = cleanupFixture();
    await fixture.uploads.begin(HASH);
    const bucket = { delete: vi.fn<() => Promise<void>>().mockRejectedValue(7) };
    await expect(runLoggedPhotoCleanup(bucket, fixture.store, AFTER_GRACE)).rejects.toBe(7);
    expect(logged.mock.calls).toEqual([failedStep("UnknownError")]);
  });
});
