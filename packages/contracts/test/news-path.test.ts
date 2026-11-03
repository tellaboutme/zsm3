import { describe, it } from "vitest";

import { newsPath, sitePathSchema } from "../src/content.ts";

describe("newsPath", () => {
  it("puts the publication year and the slug under /aktualnosci", ({ expect }) => {
    expect(newsPath({ date: "2026-10-23", slug: "dzien-patrona" })).toBe(
      "/aktualnosci/2026/dzien-patrona",
    );
    expect(newsPath({ date: "1999-01-01", slug: "a" })).toBe("/aktualnosci/1999/a");
  });

  it("keeps the year of the date only, so a later day in the same year keeps the address", ({
    expect,
  }) => {
    expect(newsPath({ date: "2026-12-31", slug: "salon" })).toBe(
      newsPath({ date: "2026-01-02", slug: "salon" }),
    );
  });

  it("is always a valid site path for a valid slug", ({ expect }) => {
    for (const slug of ["salon-2026", "x", "dzien-otwarty-szkoly"]) {
      expect(sitePathSchema.safeParse(newsPath({ date: "2026-05-05", slug })).success).toBe(true);
    }
  });

  it("encodes anything that is not a plain path segment", ({ expect }) => {
    expect(newsPath({ date: "2026-05-05", slug: "a b/c?d#e" })).toBe(
      "/aktualnosci/2026/a%20b%2Fc%3Fd%23e",
    );
    expect(newsPath({ date: "2026-05-05", slug: "żółć" })).toBe(
      "/aktualnosci/2026/%C5%BC%C3%B3%C5%82%C4%87",
    );
  });
});
