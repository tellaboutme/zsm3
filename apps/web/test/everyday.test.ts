import { describe, it } from "vitest";

import { regularSchedule } from "../src/data/bell-schedule.ts";
import { bellVariants } from "../src/data/bell-variants.ts";
import { schoolYearEvents } from "../src/data/calendar/index.ts";
import { sections } from "../src/data/navigation.ts";
import {
  lessonsFrom,
  REGULAR_LABEL,
  scheduleFor,
  scheduleRows,
  upcomingVariants,
} from "../src/lib/bells.ts";
import {
  byMonth,
  eventKindLabels,
  eventKinds,
  isAudienceFilter,
  isKindFilter,
  matchesCalendarFilter,
  monthLabel,
  type SchoolEvent,
} from "../src/lib/calendar.ts";
import {
  needsInPageNav,
  sectionTitleFor,
  siblingLinks,
  type ContentPage,
} from "../src/lib/content.ts";

describe("bell schedule", () => {
  it("numbers lessons from their times", ({ expect }) => {
    expect(
      lessonsFrom([
        ["07:30", "08:15"],
        ["08:20", "09:05"],
      ]),
    ).toEqual([
      { number: 1, start: "07:30", end: "08:15" },
      { number: 2, start: "08:20", end: "09:05" },
    ]);
  });

  it("names the regular plan", ({ expect }) => {
    expect(REGULAR_LABEL).toBe("Zwykły plan lekcji");
  });

  it("uses a shortened variant only on its day", ({ expect }) => {
    expect(scheduleFor(bellVariants, regularSchedule, "2026-09-08")).toMatchObject({
      label: "Lekcje skrócone od 9. lekcji",
      variant: true,
    });
    expect(scheduleFor(bellVariants, regularSchedule, "2026-09-10")).toEqual({
      label: REGULAR_LABEL,
      lessons: regularSchedule,
      variant: false,
    });
  });

  it("lists variants from today onwards in date order", ({ expect }) => {
    const variants = [
      { date: "2026-11-02", label: "B", lessons: [] },
      { date: "2026-10-01", label: "A", lessons: [] },
      { date: "2026-10-22", label: "C", lessons: [] },
    ];

    expect(upcomingVariants(variants, "2026-10-22").map((variant) => variant.label)).toEqual([
      "C",
      "B",
    ]);
  });

  it("measures lessons and the breaks after them", ({ expect }) => {
    const rows = scheduleRows(regularSchedule);

    expect(rows[0]).toEqual({ lesson: regularSchedule[0], minutes: 45, breakAfter: 5 });
    expect(rows[4]?.breakAfter).toBe(20);
    expect(rows.at(-1)?.breakAfter).toBeUndefined();
    expect(scheduleRows(bellVariants[0]?.lessons ?? [])[9]?.minutes).toBe(30);
  });
});

describe("calendar", () => {
  const event = (audience: SchoolEvent["audience"], kind: SchoolEvent["kind"]): SchoolEvent => ({
    date: "2026-11-18",
    title: "Test",
    audience,
    kind,
  });

  it("groups events by month in date order", ({ expect }) => {
    const groups = byMonth([
      { ...event("Wszyscy", "wolne"), date: "2026-12-22" },
      { ...event("Wszyscy", "wolne"), date: "2026-11-18" },
      { ...event("Wszyscy", "wolne"), date: "2026-12-01" },
    ]);

    expect(groups.map((group) => [group.month, group.events.length])).toEqual([
      ["2026-11", 1],
      ["2026-12", 2],
    ]);
    expect(groups[1]?.events.map((entry) => entry.date)).toEqual(["2026-12-01", "2026-12-22"]);
    expect(monthLabel("2027-02")).toBe("luty 2027");
  });

  it("labels every kind of event in Polish", ({ expect }) => {
    expect(eventKinds.map((kind) => eventKindLabels[kind])).toEqual([
      "Rok szkolny",
      "Przerwy",
      "Dni wolne",
      "Zebrania z rodzicami",
      "Uroczystości",
      "Oceny i klasyfikacja",
      "Egzaminy",
      "Praktyki zawodowe",
    ]);
  });

  it("accepts only known filters", ({ expect }) => {
    expect(isAudienceFilter("wszyscy")).toBe(true);
    expect(isAudienceFilter("Uczniowie")).toBe(true);
    expect(isAudienceFilter("Rodzice")).toBe(true);
    expect(isAudienceFilter("Wszyscy")).toBe(false);
    expect(isAudienceFilter(undefined)).toBe(false);
    expect(isKindFilter("wszystkie")).toBe(true);
    expect(isKindFilter("egzamin")).toBe(true);
    expect(isKindFilter("sport")).toBe(false);
  });

  it("shows events for everyone under every audience filter", ({ expect }) => {
    expect(matchesCalendarFilter(event("Wszyscy", "wolne"), "Rodzice", "wszystkie")).toBe(true);
    expect(matchesCalendarFilter(event("Rodzice", "zebranie"), "Rodzice", "zebranie")).toBe(true);
    expect(matchesCalendarFilter(event("Uczniowie", "egzamin"), "Rodzice", "wszystkie")).toBe(
      false,
    );
    expect(matchesCalendarFilter(event("Uczniowie", "egzamin"), "wszyscy", "egzamin")).toBe(true);
    expect(matchesCalendarFilter(event("Uczniowie", "egzamin"), "Uczniowie", "wolne")).toBe(false);
  });

  it("keeps the school year data consistent", ({ expect }) => {
    for (const entry of schoolYearEvents) {
      expect(entry.endDate === undefined || entry.endDate > entry.date, entry.title).toBe(true);
    }
    expect(schoolYearEvents.filter((entry) => entry.kind === "zebranie")).toHaveLength(4);
  });
});

describe("content pages", () => {
  const page = (count: number): ContentPage => ({
    path: "/szkola/x",
    kicker: "",
    title: "",
    intro: "",
    sections: [...Array.from({ length: count }).keys()].map((index) => ({
      id: `s${String(index)}`,
      title: "",
      blocks: [],
    })),
  });

  it("adds in-page navigation from four sections", ({ expect }) => {
    expect(needsInPageNav(page(3))).toBe(false);
    expect(needsInPageNav(page(4))).toBe(true);
  });

  it("lists the other pages of the same menu group", ({ expect }) => {
    expect(siblingLinks(sections, "/szkola/historia").map((link) => link.label)).toEqual([
      "O szkole",
      "Patron",
      "Kadra",
      "Struktura",
    ]);
    expect(siblingLinks(sections, "/nie-ma")).toEqual([]);
  });

  it("finds the section a page belongs to", ({ expect }) => {
    expect(sectionTitleFor(sections, "/szkola/patron")).toEqual({
      label: "Szkoła",
      href: "/szkola",
    });
    expect(sectionTitleFor(sections, "/szkola")).toBeUndefined();
  });
});
