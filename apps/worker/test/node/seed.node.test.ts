import { contentPageSchema, newsSchema } from "@zsm3/contracts/content";
import { describe, it } from "vitest";

import { fileLink, seedFile, seedFiles, storedFile } from "../../seed/files.ts";
import { seedNews } from "../../seed/news/index.ts";
import { seedPages } from "../../seed/pages/index.ts";

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
