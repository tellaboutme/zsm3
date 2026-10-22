import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, describe, it } from "vitest";

import { cryptoRandom } from "../src/storage/ids.ts";
import { newsRepo } from "../src/storage/news-repo.ts";
import { redirectsRepo } from "../src/storage/redirects-repo.ts";

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
});
