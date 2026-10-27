import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { contentPageSchema, newsSchema } from "@zsm3/contracts/content";
import { requestPiiSchema } from "@zsm3/contracts/requests";
import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { SECRETS } from "./request-harness.ts";
import { fileLink, seedFile, seedFiles, storedFile } from "../../seed/files.ts";
import { seedNews } from "../../seed/news/index.ts";
import { seedPages } from "../../seed/pages/index.ts";
import { seedRequests } from "../../seed/requests.ts";
import { requestsConfig } from "../../src/env.ts";
import { piiCrypto } from "../../src/security/pii-crypto.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";
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
  it("creates two demo requests concurrently without replacing encrypted pii or sending mail", async ({
    expect,
  }) => {
    const db = memoryDatabase();
    const store = { db, clock: FIXED_CLOCK, random: cryptoRandom };
    const config = requestsConfig(SECRETS);
    const deps = {
      store,
      pii: piiCrypto(config.piiKeys, config.activePiiKeyId, store.random),
      emailIndexKey: config.emailIndexKey,
    };
    const created = await Promise.all([seedRequests(deps), seedRequests(deps)]);
    expect(created.reduce((total, count) => total + count, 0)).toBe(2);

    const all = await requestsRepo(store).list({ limit: 10 });
    expect(all.map((record) => record.id).toSorted()).toEqual([
      "01a1629f-c400-79e1-801b-afb7dcf1c171",
      "01a1629f-c400-7a3b-88f0-1d351d9882ff",
    ]);
    expect(all.map((record) => record.status).toSorted()).toEqual(["in_progress", "submitted"]);
    expect(all.map((record) => record.type).toSorted()).toEqual([
      "ENROLLMENT_CERTIFICATE",
      "STUDENT_ID_RENEWAL",
    ]);
    for (const record of all) {
      expect(record.piiCiphertext?.length).toBeGreaterThan(12);
      expect(record.piiCiphertext).not.toBeNull();
      if (record.piiCiphertext === null || record.piiKeyId === null) throw new Error("Missing PII");
      const pii = requestPiiSchema.parse(
        JSON.parse(await deps.pii.decrypt(record.piiCiphertext, record.piiKeyId, record.id)),
      );
      expect(pii.statusToken).toMatch(/^[-\w]{43}$/);
    }
    const before = db.sqlite.prepare("SELECT * FROM requests ORDER BY id").all();
    expect(await Promise.all([seedRequests(deps), seedRequests(deps)])).toEqual([0, 0]);
    expect(db.sqlite.prepare("SELECT * FROM requests ORDER BY id").all()).toEqual(before);
    expect(db.sqlite.prepare("SELECT * FROM email_outbox").all()).toEqual([]);
  });

  it("keeps ciphertext after reopening a persisted database", async ({ expect }) => {
    const directory = mkdtempSync(join(tmpdir(), "zsm3-seed-"));
    const path = join(directory, "seed.sqlite");
    try {
      const config = requestsConfig(SECRETS);
      const first = memoryDatabase(path);
      const store = { db: first, clock: FIXED_CLOCK, random: counterRandom() };
      const deps = {
        store,
        pii: piiCrypto(config.piiKeys, config.activePiiKeyId, store.random),
        emailIndexKey: config.emailIndexKey,
      };
      expect(await seedRequests(deps)).toBe(2);
      const before = first.sqlite.prepare("SELECT * FROM requests ORDER BY id").all();
      first.sqlite.close();

      const reopened = memoryDatabase(path);
      expect(
        (
          await Promise.all([
            seedRequests({ ...deps, store: { ...store, db: reopened } }),
            seedRequests({ ...deps, store: { ...store, db: reopened } }),
          ])
        ).toSorted(),
      ).toEqual([0, 0]);
      expect(reopened.sqlite.prepare("SELECT * FROM requests ORDER BY id").all()).toEqual(before);
      expect(reopened.sqlite.prepare("SELECT * FROM email_outbox").all()).toEqual([]);
      reopened.sqlite.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("generates different status tokens for independent seed runs", async ({ expect }) => {
    const config = requestsConfig(SECRETS);
    const hashes: Uint8Array[] = [];
    for (const db of [memoryDatabase(), memoryDatabase()]) {
      const store = { db, clock: FIXED_CLOCK, random: cryptoRandom };
      await seedRequests({
        store,
        pii: piiCrypto(config.piiKeys, config.activePiiKeyId, store.random),
        emailIndexKey: config.emailIndexKey,
      });
      const row = await requestsRepo(store).list({ limit: 1 });
      const first = row[0];
      if (first === undefined) throw new Error("Missing seed request");
      hashes.push(first.statusTokenHash);
      db.sqlite.close();
    }
    expect(hashes[0]).not.toEqual(hashes[1]);
  });
});
