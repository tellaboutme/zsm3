import { describe, it } from "vitest";

import { schoolYearEvents } from "../src/data/calendar.ts";
import { footerGroups, sections, utilityLinks } from "../src/data/navigation.ts";
import { isoDay, longDate, nextEvent, polishDate, warsawDay } from "../src/lib/calendar.ts";
import { sectionFor } from "../src/lib/navigation.ts";

const allLinks = [
  ...sections.flatMap((section) => section.groups.flatMap((group) => group.links)),
  ...utilityLinks,
  ...footerGroups.flatMap((group) => group.links),
];

describe("navigation model", () => {
  it("has six sections with unique ids", ({ expect }) => {
    expect(sections.map((section) => section.id)).toEqual([
      "kandydaci",
      "uczniowie",
      "rodzice",
      "szkola",
      "aktualnosci",
      "kontakt",
    ]);
  });

  it("uses site paths internally and https externally", ({ expect }) => {
    for (const link of allLinks) {
      if (link.external === true) {
        expect(link.href, link.label).toMatch(/^https:\/\//u);
      } else {
        expect(link.href, link.label).toMatch(/^\/[a-z0-9\-/#]*$/u);
      }
    }
  });

  it("keeps link labels unique within a group", ({ expect }) => {
    for (const group of [...sections.flatMap((section) => section.groups), ...footerGroups]) {
      const labels = group.links.map((link) => link.label);
      expect(new Set(labels).size, group.title).toBe(labels.length);
    }
  });

  it("finds the section of a path", ({ expect }) => {
    expect(sectionFor(sections, "/uczniowie/dzwonki")?.id).toBe("uczniowie");
    expect(sectionFor(sections, "/kandydaci")?.id).toBe("kandydaci");
    expect(sectionFor(sections, "/uczniowiex")).toBeUndefined();
    expect(sectionFor(sections, "/")).toBeUndefined();
  });
});

describe("calendar", () => {
  it("formats dates in Polish", ({ expect }) => {
    expect(longDate("2026-11-18")).toBe("18 listopada 2026");
    expect(longDate("2027-02-01")).toBe("1 lutego 2027");
  });

  it("formats with fixed locale and time zones", ({ expect }) => {
    expect(polishDate().resolvedOptions()).toMatchObject({ locale: "pl-PL", timeZone: "UTC" });
    expect(warsawDay().resolvedOptions()).toMatchObject({ locale: "sv-SE" });
    expect(warsawDay().resolvedOptions().timeZone).toBe("Europe/Warsaw");
  });

  it("reads the Warsaw calendar day", ({ expect }) => {
    expect(isoDay(new Date("2026-10-22T22:30:00Z"))).toBe("2026-10-23");
    expect(isoDay(new Date("2026-10-22T10:30:00Z"))).toBe("2026-10-22");
  });

  it("finds the next event for an audience", ({ expect }) => {
    expect(nextEvent(schoolYearEvents, "2026-10-22", "Rodzice")?.date).toBe("2026-11-18");
    expect(nextEvent(schoolYearEvents, "2026-11-18", "Rodzice")?.date).toBe("2026-11-18");
    expect(nextEvent(schoolYearEvents, "2026-12-28", "Wszyscy")?.title).toBe(
      "Zimowa przerwa świąteczna",
    );
    expect(nextEvent(schoolYearEvents, "2027-05-01", "Rodzice")).toBeUndefined();
  });
});
