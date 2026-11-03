import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { spyBucket, type BucketSpy } from "./short-link-files-support.ts";
import {
  DEMO_PDF,
  FILE_SEEDS,
  seedShortLinkFiles,
  type SeedBucket,
} from "../../seed/short-link-files.ts";
import { detectFormat } from "../../src/domain/link-file.ts";
import { openLink, unlockLink } from "../../src/short-links/resolve.ts";
import type { Store } from "../../src/storage/database.ts";
import { rateLimitsRepo } from "../../src/storage/rate-limits-repo.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

const KEY = "short-link-pepper-0123456789-0123456789";
const NOW = new Date("2026-10-27T08:00:00.000Z");

function seedable(bucket: BucketSpy): SeedBucket {
  return { put: async (key, value) => bucket.put(key, value.slice().buffer) };
}

function store(): Store {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

describe("short link file demo seeds", () => {
  it("seeds an open and a protected demo file, once", async ({ expect }) => {
    const current = store();
    const bucket = spyBucket();
    const links = shortLinksRepo(current);
    const deps = { links, rateLimits: rateLimitsRepo(current), passwordKey: KEY };

    expect(FILE_SEEDS.map((seed) => seed.code)).toEqual(["pdfmat3", "pdfzhas"]);
    expect(detectFormat(DEMO_PDF)).toBe("pdf");
    await expect(seedShortLinkFiles(current, seedable(bucket), KEY)).resolves.toBe(2);
    expect(bucket.keys()).toHaveLength(2);
    await expect(openLink({ links }, "pdfmat3", NOW)).resolves.toEqual({
      kind: "download",
      file: { name: "Karta pracy — przykład.pdf", format: "pdf", bytes: DEMO_PDF.length },
    });
    await expect(openLink({ links }, "pdfzhas", NOW)).resolves.toEqual({ kind: "locked" });
    await expect(unlockLink(deps, "pdfzhas", "zsm3-demo", NOW)).resolves.toMatchObject({
      kind: "file",
      file: { name: "Klucz odpowiedzi — przykład.pdf" },
    });
    const [key] = bucket.keys();
    const object = await bucket.get(key ?? "");
    expect(object?.size).toBe(DEMO_PDF.length);

    await expect(seedShortLinkFiles(current, seedable(bucket), KEY)).resolves.toBe(0);
    expect(bucket.keys()).toHaveLength(2);
  });

  it("skips the protected demo without a key", async ({ expect }) => {
    const current = store();
    const bucket = spyBucket();

    await expect(seedShortLinkFiles(current, seedable(bucket), undefined)).resolves.toBe(1);
    await expect(shortLinksRepo(current).find("pdfzhas")).resolves.toBeUndefined();
    await expect(seedShortLinkFiles(current, seedable(bucket), KEY)).resolves.toBe(1);
  });
});
