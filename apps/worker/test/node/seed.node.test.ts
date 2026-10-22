import { newsSchema } from "@zsm3/contracts/content";
import { describe, it } from "vitest";

import { seedNews } from "../../seed/news/index.ts";

describe("seed news", () => {
  it("is valid, unique per year and long enough to paginate", ({ expect }) => {
    const keys = seedNews.map((item) => `${item.date.slice(0, 4)}/${item.slug}`);

    expect(seedNews.map((item) => newsSchema.parse(item))).toEqual(seedNews);
    expect(new Set(keys).size).toBe(seedNews.length);
    expect(seedNews.length).toBeGreaterThan(9);
  });
});
