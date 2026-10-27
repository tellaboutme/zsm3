import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, describe, it } from "vitest";

import { cryptoRandom } from "../src/storage/ids.ts";
import { newsRepo } from "../src/storage/news-repo.ts";
import { pagesRepo } from "../src/storage/pages-repo.ts";
import { redirectsRepo } from "../src/storage/redirects-repo.ts";
import { sitemapRepo } from "../src/storage/sitemap-repo.ts";

const store = { db: env.DB, clock: () => new Date("2026-10-22T08:00:00Z"), random: cryptoRandom };

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("storage on D1", () => {
  it("saves and reads news with the real database", async ({ expect }) => {
    const repo = newsRepo(store);
    await repo.save(
      {
        slug: "salon-maturzystow",
        date: "2026-09-22",
        category: "Technikum",
        title: "Salon Maturzystów",
        lead: "Klasy piąte na Uniwersytecie Jagiellońskim.",
        body: [{ type: "paragraph", content: [{ type: "text", text: "Relacja." }] }],
      },
      "published",
    );

    expect(await repo.find("2026", "salon-maturzystow")).toMatchObject({
      title: "Salon Maturzystów",
    });
    expect(await repo.countPublished({ year: "2026" })).toBe(1);
  });

  it("resolves redirects with the real database", async ({ expect }) => {
    const repo = redirectsRepo(store);
    await repo.save({ from: "/kontakt-2/", to: "/kontakt" });

    expect(await repo.target("/kontakt-2")).toBe("/kontakt");
  });

  it("lists published pages and articles for the sitemap", async ({ expect }) => {
    await pagesRepo(store).save(
      {
        path: "/szkola/historia",
        kicker: "Szkoła",
        title: "Historia",
        intro: "Od 1957 roku.",
        sections: [
          {
            id: "poczatki",
            title: "Początki",
            blocks: [
              {
                type: "rich-text",
                document: [{ type: "paragraph", content: [{ type: "text", text: "Rok 1957." }] }],
              },
            ],
          },
        ],
      },
      "published",
    );
    await pagesRepo(store).save(
      {
        path: "/szkola/projekty",
        kicker: "Szkoła",
        title: "Projekty",
        intro: "W przygotowaniu.",
        sections: [
          {
            id: "plany",
            title: "Plany",
            blocks: [
              {
                type: "rich-text",
                document: [{ type: "paragraph", content: [{ type: "text", text: "Wkrótce." }] }],
              },
            ],
          },
        ],
      },
      "draft",
    );
    await newsRepo(store).save(
      {
        slug: "dni-otwarte",
        date: "2026-10-18",
        category: "Technikum",
        title: "Dni otwarte",
        lead: "Zapraszamy kandydatów.",
        body: [{ type: "paragraph", content: [{ type: "text", text: "Program." }] }],
      },
      "published",
    );
    const entries = await sitemapRepo(store).published();

    expect(entries).toContainEqual({
      path: "/szkola/historia",
      lastmod: "2026-10-22T08:00:00.000Z",
    });
    expect(entries).toContainEqual({
      path: "/aktualnosci/2026/dni-otwarte",
      lastmod: "2026-10-22T08:00:00.000Z",
    });
    expect(entries.map((entry) => entry.path)).not.toContain("/szkola/projekty");
  });
});
