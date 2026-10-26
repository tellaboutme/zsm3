import { contentPageSchema, newsSchema } from "@zsm3/contracts/content";
import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { SECRETS } from "./request-harness.ts";
import { fileLink, seedFile, seedFiles, storedFile } from "../../seed/files.ts";
import { seedNews } from "../../seed/news/index.ts";
import { seedPages } from "../../seed/pages/index.ts";
import { seedRequests } from "../../seed/requests.ts";
import { requestsConfig } from "../../src/env.ts";
import { piiCrypto } from "../../src/security/pii-crypto.ts";
import { requestsRepo } from "../../src/storage/requests-repo.ts";

describe("seed news", () => {
  it("is valid, unique per year and long enough to paginate", ({ expect }) => {
    const keys = seedNews.map((item) => `${item.date.slice(0, 4)}/${item.slug}`);

    expect(seedNews.map((item) => newsSchema.parse(item))).toEqual(seedNews);
    expect(new Set(keys).size).toBe(seedNews.length);
    expect(seedNews.length).toBeGreaterThan(9);
  });
});

describe("seed pages", () => {
  it("are valid and have unique paths", ({ expect }) => {
    const paths = seedPages.map((page) => page.path);

    expect(seedPages.map((page) => contentPageSchema.parse(page))).toEqual(seedPages);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain("/szkola/historia");
  });
});

describe("seed files", () => {
  it("describe every file by content hash and link to it under /media", ({ expect }) => {
    const statute = seedFile("statute-zsm3");

    expect(Object.keys(seedFiles).length).toBeGreaterThan(50);
    expect(storedFile(statute)).toEqual({
      key: `d/${statute.sha256}.pdf`,
      name: statute.name,
      format: "pdf",
      bytes: statute.bytes,
    });
    expect(fileLink("statute-zsm3", "Statut")).toEqual({
      title: "Statut",
      href: `/media/d/${statute.sha256}.pdf`,
      format: "pdf",
      bytes: statute.bytes,
    });
    expect(fileLink("statute-zsm3", "Statut", "Tekst jednolity.").description).toBe(
      "Tekst jednolity.",
    );
    expect(() => seedFile("brak")).toThrow("Unknown seed file brak");
  });
});

describe("seed requests", () => {
  it("creates two demo requests with encrypted pii", async ({ expect }) => {
    const store = { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
    const config = requestsConfig(SECRETS);

    expect(
      await seedRequests({
        store,
        pii: piiCrypto(config.piiKeys, config.activePiiKeyId, store.random),
        emailIndexKey: config.emailIndexKey,
      }),
    ).toBe(2);

    const all = await requestsRepo(store).list({ limit: 10 });
    expect(all.map((record) => record.status).toSorted()).toEqual(["in_progress", "submitted"]);
    expect(all.map((record) => record.type).toSorted()).toEqual([
      "ENROLLMENT_CERTIFICATE",
      "STUDENT_ID_RENEWAL",
    ]);
    for (const record of all) {
      expect(record.piiCiphertext?.length).toBeGreaterThan(12);
      expect(record.piiCiphertext).not.toBeNull();
    }
  });
});
