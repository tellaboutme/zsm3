import type { News } from "@zsm3/contracts/content";
import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { newsRepo, type NewsRepo } from "../../src/storage/news-repo.ts";

const body = [{ type: "paragraph" as const, content: [{ type: "text" as const, text: "Treść." }] }];

function news(slug: string, date: string, category = "Sport"): News {
  return { slug, date, category, title: `Tytuł ${slug}`, lead: "Lead.", body };
}

async function seeded(): Promise<NewsRepo> {
  const repo = newsRepo({ db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() });
  await repo.save(news("najstarszy", "2025-05-01"), "published");
  await repo.save(news("alfa", "2026-09-01", "Zdrowie"), "published");
  await repo.save(news("beta", "2026-09-01"), "published");
  await repo.save(news("srodek", "2026-09-10", "Zdrowie"), "published");
  await repo.save(news("szkic", "2026-09-20"), "draft");
  await repo.save(news("najnowszy", "2026-10-01"), "published");
  return repo;
}

const slugs = (items: readonly (News | undefined)[]): readonly (string | undefined)[] =>
  items.map((item) => item?.slug);

describe("news navigation", () => {
  it("links an article to the next newer and older published ones", async ({ expect }) => {
    const repo = await seeded();

    const middle = await repo.neighbours(news("srodek", "2026-09-10"));
    const newest = await repo.neighbours(news("najnowszy", "2026-10-01"));
    const oldest = await repo.neighbours(news("najstarszy", "2025-05-01"));

    expect(slugs([middle.newer, middle.older])).toEqual(["najnowszy", "alfa"]);
    expect(slugs([newest.newer, newest.older])).toEqual([undefined, "srodek"]);
    expect(slugs([oldest.newer, oldest.older])).toEqual(["beta", undefined]);
  });

  it("orders articles from the same day by slug, like the listing", async ({ expect }) => {
    const repo = await seeded();

    const first = await repo.neighbours(news("alfa", "2026-09-01"));
    const second = await repo.neighbours(news("beta", "2026-09-01"));

    expect(slugs([first.newer, first.older])).toEqual(["srodek", "beta"]);
    expect(slugs([second.newer, second.older])).toEqual(["alfa", "najstarszy"]);
  });

  it("suggests the same category first, then the newest, never itself", async ({ expect }) => {
    const repo = await seeded();

    const related = await repo.related(news("alfa", "2026-09-01", "Zdrowie"), 3);
    const all = await repo.related(news("beta", "2026-09-01"), 10);

    expect(slugs(related)).toEqual(["srodek", "najnowszy", "beta"]);
    expect(slugs(all)).toEqual(["najnowszy", "najstarszy", "srodek", "alfa"]);
  });
});
