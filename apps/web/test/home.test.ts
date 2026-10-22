import { describe, it } from "vitest";

import { schoolYearEvents } from "../src/data/calendar.ts";
import { news } from "../src/data/news/index.ts";
import { professions } from "../src/data/professions.ts";
import { upcomingEvents } from "../src/lib/calendar.ts";
import { latestNews, newsHref } from "../src/lib/news.ts";
import {
  fieldCounts,
  fieldLabels,
  fields,
  isFieldFilter,
  matchesField,
  pathLabel,
} from "../src/lib/professions.ts";

describe("professions", () => {
  it("lists thirteen distinct professions in five fields", ({ expect }) => {
    expect(professions).toHaveLength(13);
    expect(new Set(professions.map((profession) => profession.slug)).size).toBe(13);
    expect([...fieldCounts(professions)]).toEqual([
      ["informatyka", 2],
      ["mechatronika", 2],
      ["motoryzacja", 5],
      ["lotnictwo", 3],
      ["logistyka", 1],
    ]);
  });

  it("uses official qualification codes", ({ expect }) => {
    const codes = professions.flatMap((profession) =>
      profession.qualifications.map((qualification) => qualification.code),
    );

    expect(codes.every((code) => /^[A-Z]{3}\.\d{2}$/u.test(code))).toBe(true);
  });

  it("labels every field", ({ expect }) => {
    expect(fields.map((field) => fieldLabels[field])).toEqual([
      "Informatyka",
      "Mechatronika i robotyka",
      "Motoryzacja",
      "Lotnictwo",
      "Porty i terminale",
    ]);
  });

  it("accepts only known filters", ({ expect }) => {
    expect(isFieldFilter("wszystkie")).toBe(true);
    expect(isFieldFilter("lotnictwo")).toBe(true);
    expect(isFieldFilter("Lotnictwo")).toBe(false);
    expect(isFieldFilter(undefined)).toBe(false);
  });

  it("matches tiles against the chosen field", ({ expect }) => {
    expect(matchesField("lotnictwo", "wszystkie")).toBe(true);
    expect(matchesField(undefined, "wszystkie")).toBe(true);
    expect(matchesField("lotnictwo", "lotnictwo")).toBe(true);
    expect(matchesField("logistyka", "lotnictwo")).toBe(false);
  });

  it("describes study paths in Polish", ({ expect }) => {
    expect(pathLabel({ school: "technikum", years: 5 })).toBe("Technikum · 5 lat");
    expect(pathLabel({ school: "branzowa-1", years: 3 })).toBe("Branżowa I stopnia · 3 lata");
    expect(pathLabel({ school: "branzowa-2", years: 2 })).toBe("Branżowa II stopnia · 2 lata");
    expect(pathLabel({ school: "technikum", years: 4 })).toBe("Technikum · 4 lata");
  });
});

describe("news", () => {
  it("links to the article under its year", ({ expect }) => {
    expect(
      newsHref({
        slug: "rajd",
        date: "2026-10-09",
        category: "Sport",
        title: "Rajd",
        lead: "",
        body: [],
      }),
    ).toBe("/aktualnosci/2026/rajd");
  });

  it("returns the newest items first", ({ expect }) => {
    const shuffled = news.toReversed();

    expect(latestNews(shuffled, 2).map((item) => item.date)).toEqual(["2026-10-19", "2026-10-17"]);
    expect(latestNews(shuffled, news.length + 5)).toHaveLength(news.length);
  });
});

describe("upcomingEvents", () => {
  it("keeps running and future events in date order", ({ expect }) => {
    const titles = upcomingEvents(schoolYearEvents.toReversed(), "2026-12-24", 2).map(
      (event) => event.title,
    );

    expect(titles).toEqual(["Zimowa przerwa świąteczna", "Zebrania informacyjne z rodzicami"]);
  });

  it("includes an event on its own day and drops past ones", ({ expect }) => {
    const events = [{ date: "2026-10-23" }, { date: "2026-10-22" }];

    expect(upcomingEvents(events, "2026-10-23", 5)).toEqual([{ date: "2026-10-23" }]);
    expect(upcomingEvents(events, "2027-01-01", 5)).toEqual([]);
  });
});
