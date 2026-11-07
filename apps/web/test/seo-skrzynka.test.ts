import { it } from "vitest";

import { shouldNoindex, sitemapEntries } from "../src/lib/seo.ts";

it("keeps every Skrzynka page out of the index and the sitemap", ({ expect }) => {
  for (const path of ["/skrzynka", "/skrzynka/abcdefghjkmn", "/skrzynka/strona/2"]) {
    expect(shouldNoindex(new URL(path, "https://example.org")), path).toBe(true);
  }
  expect(shouldNoindex(new URL("/skrzynkawpisy", "https://example.org"))).toBe(false);
  expect(sitemapEntries(["/skrzynka", "/skrzynkawpisy"], [])).toEqual([{ path: "/skrzynkawpisy" }]);
});
