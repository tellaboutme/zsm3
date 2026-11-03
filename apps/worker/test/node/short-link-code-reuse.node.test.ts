import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { CODE_ATTEMPTS, freeCode } from "../../src/short-links/create.ts";
import type { Store } from "../../src/storage/database.ts";
import { shortLinkFilesRepo } from "../../src/storage/short-link-files-repo.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

const CODE = "abcdefg";
const CODE_BYTES = [8, 9, 10, 11, 12, 13, 14];
const OBJECT_KEY = "s/0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b";
const AUTHOR = "nauczyciel@zsm3.test";

function store(): Store {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

function sameCode(): (size: number) => Uint8Array {
  return (size) => Uint8Array.from(CODE_BYTES.slice(0, size));
}

async function prunedFileLink(current: Store): Promise<void> {
  const files = shortLinkFilesRepo(current);
  await files.reserve({
    objectKey: OBJECT_KEY,
    name: "Karta.pdf",
    format: "pdf",
    bytes: 10,
    createdBy: AUTHOR,
  });
  await files.attach({
    code: CODE,
    objectKey: OBJECT_KEY,
    password: null,
    createdBy: AUTHOR,
    expiresAt: "2026-11-01T00:00:00.000Z",
  });
  await shortLinksRepo(current).pruneLapsed("2030-01-01T00:00:00.000Z", 500);
}

describe("short link code reuse", () => {
  it("never reissues a code that a file row still references", async ({ expect }) => {
    const current = store();
    const links = shortLinksRepo(current);
    await prunedFileLink(current);

    await expect(links.find(CODE)).resolves.toBeUndefined();
    await expect(links.inUse(CODE)).resolves.toBe(true);
    await expect(freeCode({ links, random: sameCode() })).resolves.toBeUndefined();
  });

  it("tries a fixed number of codes before giving up", async ({ expect }) => {
    const current = store();
    const links = shortLinksRepo(current);
    await prunedFileLink(current);
    const tries: number[] = [];
    const counted = (size: number): Uint8Array => {
      tries.push(size);
      return sameCode()(size);
    };

    await expect(freeCode({ links, random: counted })).resolves.toBeUndefined();
    expect(tries).toHaveLength(CODE_ATTEMPTS);
  });

  it("issues the code again once the file row is forgotten", async ({ expect }) => {
    const current = store();
    const links = shortLinksRepo(current);
    const files = shortLinkFilesRepo(current);
    await prunedFileLink(current);
    await files.markRemoved(OBJECT_KEY, "2030-01-01T00:00:00.000Z");
    await files.forgetDetached();

    await expect(links.inUse(CODE)).resolves.toBe(false);
    await expect(freeCode({ links, random: sameCode() })).resolves.toBe(CODE);
  });

  it("treats a live link code as taken", async ({ expect }) => {
    const current = store();
    const links = shortLinksRepo(current);
    await links.create({
      code: CODE,
      target: "https://example.org/materialy",
      password: null,
      createdBy: AUTHOR,
      expiresAt: "2030-01-01T00:00:00.000Z",
    });

    await expect(links.inUse(CODE)).resolves.toBe(true);
    await expect(links.inUse("bcdefgh")).resolves.toBe(false);
  });
});

describe("recording a new page link", () => {
  it("notes in the audit log that an open link has no password", async ({ expect }) => {
    const current = store();
    await shortLinksRepo(current).createAudited({
      code: CODE,
      target: "https://example.org/materialy",
      password: null,
      createdBy: AUTHOR,
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
    const row = await current.db.prepare("SELECT details_json FROM audit_log").first();

    expect(row).toEqual({
      details_json: JSON.stringify({ kind: "url", passwordProtected: false }),
    });
  });

  it("names the creation batch when D1 reports uneven changes", async ({ expect }) => {
    const current = store();
    const inconsistent = shortLinksRepo({
      ...current,
      db: {
        prepare: (query) => current.db.prepare(query),
        batch: async () =>
          await Promise.resolve([{ meta: { changes: 1 } }, { meta: { changes: 0 } }]),
      },
    });

    await expect(
      inconsistent.createAudited({
        code: CODE,
        target: "https://example.org/materialy",
        password: null,
        createdBy: AUTHOR,
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
    ).rejects.toThrow("Inconsistent short link create batch");
  });
});
