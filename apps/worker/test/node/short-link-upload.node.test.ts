import { MAX_LINK_FILE_BYTES } from "@zsm3/contracts/short-links";
import { describe, it } from "vitest";

import { counterRandom } from "./memory-database.ts";
import {
  fileRows,
  fileStore,
  NOW,
  resolveDeps,
  spyBucket,
  upload,
  uploadDeps,
} from "./short-link-files-support.ts";
import { docx, PDF } from "./zip-fixtures.ts";
import { openLink, unlockLink } from "../../src/short-links/resolve.ts";
import { createFileLink, objectKeyFor } from "../../src/short-links/upload.ts";
import type { ShortLinksRepo } from "../../src/storage/short-links-repo.ts";
import { linkObjectKeySchema } from "../../src/storage/short-links-rows.ts";

describe("uploading a file for a short link", () => {
  it("stores the file privately and opens it only through the link", async ({ expect }) => {
    const store = fileStore();
    const bucket = spyBucket();
    const outcome = await createFileLink(uploadDeps(store, bucket), upload(PDF));

    expect(outcome.kind).toBe("created");
    if (outcome.kind !== "created") return;
    const [key] = bucket.keys();
    expect(linkObjectKeySchema.safeParse(key).success).toBe(true);
    expect(key).not.toMatch(/karta|pdf/u);
    expect(await fileRows(store)).toEqual([
      { object_key: key, code: outcome.code, removed_at: null },
    ]);
    await expect(openLink(resolveDeps(store), outcome.code, NOW)).resolves.toEqual({
      kind: "download",
      file: { name: "karta.pdf", format: "pdf", bytes: PDF.length },
    });
    await expect(unlockLink(resolveDeps(store), outcome.code, undefined, NOW)).resolves.toEqual({
      kind: "file",
      file: { objectKey: key, name: "karta.pdf", format: "pdf", bytes: PDF.length },
    });
  });

  it("puts a password in front of the file and hides it until the password matches", async ({
    expect,
  }) => {
    const store = fileStore();
    const outcome = await createFileLink(
      uploadDeps(store, spyBucket()),
      upload(docx(), { name: "zadanie.docx", password: "klasa4tp" }),
    );
    if (outcome.kind !== "created") throw new Error("fixture");
    const deps = resolveDeps(store);

    await expect(openLink(deps, outcome.code, NOW)).resolves.toEqual({ kind: "locked" });
    await expect(unlockLink(deps, outcome.code, undefined, NOW)).resolves.toEqual({
      kind: "locked",
    });
    await expect(unlockLink(deps, outcome.code, "zle-haslo", NOW)).resolves.toEqual({
      kind: "locked",
    });
    await expect(unlockLink(deps, outcome.code, "klasa4tp", NOW)).resolves.toMatchObject({
      kind: "file",
      file: { name: "zadanie.docx", format: "docx" },
    });
  });

  it("gives each upload its own object, even for identical content", async ({ expect }) => {
    const store = fileStore();
    const bucket = spyBucket();
    const first = await createFileLink(uploadDeps(store, bucket), upload(PDF));
    const second = await createFileLink(uploadDeps(store, bucket), upload(PDF));

    expect(first.kind).toBe("created");
    expect(second.kind).toBe("created");
    expect(new Set(bucket.keys()).size).toBe(2);
    expect(first).not.toEqual(second);
  });

  it("refuses files before anything is stored", async ({ expect }) => {
    const store = fileStore();
    const bucket = spyBucket();
    const deps = uploadDeps(store, bucket);
    const big = new Uint8Array(MAX_LINK_FILE_BYTES + 1);
    big.set(PDF);

    await expect(createFileLink(deps, upload(new Uint8Array()))).resolves.toEqual({
      kind: "empty",
    });
    await expect(createFileLink(deps, upload(big))).resolves.toEqual({ kind: "large" });
    await expect(createFileLink(deps, upload(PDF, { name: "strona.html" }))).resolves.toEqual({
      kind: "unsupported",
    });
    await expect(createFileLink(deps, upload(PDF, { password: "krot" }))).resolves.toEqual({
      kind: "invalid",
    });
    await expect(
      createFileLink(
        { ...uploadDeps(store, bucket), passwordKey: undefined },
        upload(PDF, { password: "klasa4tp" }),
      ),
    ).resolves.toEqual({ kind: "unavailable" });
    expect(bucket.keys()).toEqual([]);
    expect(await fileRows(store)).toEqual([]);
  });

  it("accepts a file of exactly the size limit", async ({ expect }) => {
    const store = fileStore();
    const exact = new Uint8Array(MAX_LINK_FILE_BYTES);
    exact.set(PDF);

    await expect(
      createFileLink(uploadDeps(store, spyBucket()), upload(exact)),
    ).resolves.toMatchObject({
      kind: "created",
    });
  });

  it("gives up when no free code is found and stores nothing", async ({ expect }) => {
    const store = fileStore();
    const bucket = spyBucket();
    const deps = uploadDeps(store, bucket);
    const taken: ShortLinksRepo = {
      ...deps.links,
      inUse: async () => Promise.resolve(true),
    };

    await expect(createFileLink({ ...deps, links: taken }, upload(PDF))).resolves.toEqual({
      kind: "exhausted",
    });
    expect(bucket.keys()).toEqual([]);
  });
});

describe("private object keys", () => {
  it("are made from the clock and server randomness only", ({ expect }) => {
    const key = objectKeyFor(new Date(1_800_000_000_000), counterRandom());
    expect(key).toMatch(/^s\/01a3185c-5000-7101-8101-010101010101$/u);
    expect(linkObjectKeySchema.safeParse(key).success).toBe(true);
  });
});
