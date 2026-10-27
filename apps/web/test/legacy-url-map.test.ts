import { readFileSync } from "node:fs";

import { seedPages } from "@zsm3/worker/seed/pages/index.ts";
import { describe, it } from "vitest";

import { seedNews } from "../../worker/seed/news/index.ts";
import { buildSiteMap } from "../src/data/site-map.ts";
import { mapHrefs } from "../src/lib/site-map.ts";

const corpus = readFileSync(
  new URL("../../../tools/data/legacy-url-map.csv", import.meta.url),
  "utf8",
);
const destinations = new Set([
  ...mapHrefs(buildSiteMap(seedPages)),
  ...seedNews.map((article) => `/aktualnosci/${article.date.slice(0, 4)}/${article.slug}`),
  "/uczniowie/wzory-dokumentow",
  "/rodzice/wywiadowki",
  "/szkola/kadra",
  "/szkola/terminarz",
]);

describe("legacy URL map", () => {
  it("only targets pages served by the site or seeded content", ({ expect }) => {
    const rows = corpus
      .trim()
      .split(/\r?\n/u)
      .slice(1)
      .map((line) => line.split(","));
    const missing = rows.filter((row) => !destinations.has(row[1] ?? ""));
    const mismatchedNews = rows.filter(([source, target]) => {
      const dated = /^\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)\/$/u.exec(source ?? "");
      const year = dated?.[1];
      const month = dated?.[2];
      const day = dated?.[3];
      const slug = dated?.[4];
      if (year === undefined || month === undefined || day === undefined || slug === undefined) {
        return false;
      }
      return !seedNews.some(
        (article) =>
          article.date === `${year}-${month}-${day}` &&
          article.slug === slug &&
          target === `/aktualnosci/${year}/${slug}`,
      );
    });

    expect(missing).toEqual([]);
    expect(mismatchedNews).toEqual([]);
  });
});
