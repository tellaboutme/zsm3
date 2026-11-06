import { describe, it, vi } from "vitest";

import {
  fileRows,
  fileStore,
  linkCount,
  spyBucket,
  upload,
  uploadDeps,
} from "./short-link-files-support.ts";
import { PDF } from "./zip-fixtures.ts";
import { createFileLink } from "../../src/short-links/upload.ts";

describe("recovering from storage failures", () => {
  it("leaves nothing behind when R2 refuses the object", async ({ expect }) => {
    const store = fileStore();
    const bucket = spyBucket();
    const failing = { ...bucket, put: async () => Promise.reject(new TypeError("r2 down")) };

    await expect(createFileLink(uploadDeps(store, failing), upload(PDF))).rejects.toThrow(
      "r2 down",
    );
    expect(await fileRows(store)).toEqual([]);
    expect(await linkCount(store)).toBe(0);
    expect(bucket.deleted).toHaveLength(1);
  });

  it("removes the object when D1 fails after it was stored", async ({ expect }) => {
    const store = fileStore();
    const bucket = spyBucket();
    const deps = uploadDeps(store, bucket);
    const files = { ...deps.files, attach: async () => Promise.reject(new RangeError("d1 down")) };

    await expect(createFileLink({ ...deps, files }, upload(PDF))).rejects.toThrow("d1 down");
    expect(bucket.keys()).toEqual([]);
    expect(await fileRows(store)).toEqual([]);
    expect(await linkCount(store)).toBe(0);
  });

  it("removes the object when the pending row vanished before the link was made", async ({
    expect,
  }) => {
    const store = fileStore();
    const bucket = spyBucket();
    const deps = uploadDeps(store, bucket);
    const files = { ...deps.files, attach: async () => Promise.resolve(false) };

    await expect(createFileLink({ ...deps, files }, upload(PDF))).resolves.toEqual({
      kind: "failed",
    });
    expect(bucket.keys()).toEqual([]);
    expect(await fileRows(store)).toEqual([]);
  });

  it("leaves a failed clean-up to the sweep and logs no file details", async ({ expect }) => {
    const store = fileStore();
    const bucket = spyBucket();
    const deps = uploadDeps(store, bucket);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = {
      ...bucket,
      put: async () => Promise.reject(new TypeError("r2 down")),
      delete: async () => Promise.reject(new SyntaxError("r2 still down")),
    };

    await expect(createFileLink({ ...deps, bucket: broken }, upload(PDF))).rejects.toThrow(
      "r2 down",
    );
    expect(errors).toHaveBeenCalledWith(
      JSON.stringify({ event: "short_link_file_cleanup_deferred", errorName: "SyntaxError" }),
    );
    errors.mockRestore();
    expect(await fileRows(store)).toEqual([
      expect.objectContaining({ code: null, removed_at: null }),
    ]);
  });

  it("names a thrown value that is not an error", async ({ expect }) => {
    const store = fileStore();
    const bucket = spyBucket();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = {
      ...bucket,
      put: async () => Promise.reject(new TypeError("r2 down")),
      delete: vi.fn<(key: string) => Promise<void>>().mockRejectedValue("boom"),
    };

    await expect(createFileLink(uploadDeps(store, broken), upload(PDF))).rejects.toThrow();
    expect(errors).toHaveBeenCalledWith(
      JSON.stringify({ event: "short_link_file_cleanup_deferred", errorName: "UnknownError" }),
    );
    errors.mockRestore();
  });
});
