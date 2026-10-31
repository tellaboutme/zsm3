import { seedSchoolYear as schoolYearEvents } from "@zsm3/worker/seed/calendar/index.ts";
import { describe, it } from "vitest";

import { audiencePanels } from "../src/data/home.ts";
import {
  fallbackNavigation,
  footerGroups,
  sections,
  utilityLinks,
} from "../src/data/navigation.ts";
import { isoDay, longDate, nextEvent, polishDate, warsawDay } from "../src/lib/calendar.ts";
import {
  isRoutablePagePath,
  isVisibleHref,
  sectionFor,
  visibleGroups,
  visibleNavigation,
} from "../src/lib/navigation.ts";

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

  it("hides unpublished pages without changing other links or the BIP", ({ expect }) => {
    const filtered = visibleNavigation(fallbackNavigation, new Set());
    const hrefs = [
      ...filtered.sections.flatMap((section) => section.groups.flatMap((group) => group.links)),
      ...filtered.utilityLinks,
      ...filtered.footerGroups.flatMap((group) => group.links),
    ].map((link) => link.href);
    expect(hrefs).not.toContain("/kandydaci/dzien-otwarty");
    expect(hrefs).not.toContain("/zamowienia-publiczne");
    expect(hrefs).not.toContain("/uczniowie/wychowawcy");
    expect(hrefs).not.toContain("/szkola/projekty/erasmus");
    expect(hrefs).toContain("/kandydaci/rekrutacja");
    expect(hrefs).toContain(fallbackNavigation.utilityLinks[1]?.href);
    expect(
      visibleGroups(audiencePanels, new Set())[0]?.links.map((link) => link.href),
    ).not.toContain("/kandydaci/dzien-otwarty");
    expect(
      visibleGroups(audiencePanels, new Set())[2]?.links.map((link) => link.href),
    ).not.toContain("/uczniowie/wychowawcy");
    expect(fallbackNavigation.sections[0]?.groups[0]?.links[1]?.href).toBe(
      "/kandydaci/dzien-otwarty",
    );
  });

  it("restores each link only when its page is published", ({ expect }) => {
    const openDay = "/kandydaci/dzien-otwarty";
    const procurement = "/zamowienia-publiczne";
    const candidates = visibleNavigation(fallbackNavigation, new Set([openDay]));
    expect(candidates.sections[0]?.groups[0]?.links.map((link) => link.href)).toContain(openDay);
    expect(
      candidates.footerGroups.flatMap((group) => group.links.map((link) => link.href)),
    ).not.toContain(procurement);
    expect(
      visibleGroups(audiencePanels, new Set([openDay]))[0]?.links.map((link) => link.href),
    ).toContain(openDay);
    const both = visibleNavigation(fallbackNavigation, new Set([openDay, procurement]));
    expect(both.footerGroups.flatMap((group) => group.links.map((link) => link.href))).toContain(
      procurement,
    );
    const edited = {
      ...fallbackNavigation,
      utilityLinks: [...fallbackNavigation.utilityLinks, { label: "Dzień otwarty", href: openDay }],
    };
    expect(
      visibleNavigation(edited, new Set()).utilityLinks.map((link) => link.href),
    ).not.toContain(openDay);
    expect(
      visibleNavigation(edited, new Set([openDay])).utilityLinks.map((link) => link.href),
    ).toContain(openDay);
    const fragment = {
      ...edited,
      utilityLinks: [{ label: "Dzień otwarty", href: `${openDay}#program` }],
    };
    expect(visibleNavigation(fragment, new Set()).utilityLinks).toEqual([]);
    expect(visibleNavigation(fragment, new Set([openDay])).utilityLinks).toEqual(
      fragment.utilityLinks,
    );
  });

  it("shows published teachers but never links to a page without a route", ({ expect }) => {
    const teachers = "/uczniowie/wychowawcy";
    const erasmus = "/szkola/projekty/erasmus";
    const all = visibleNavigation(fallbackNavigation, new Set([teachers, erasmus]));
    expect(all.sections[1]?.groups[2]?.links.map((link) => link.href)).toContain(teachers);
    expect(all.sections[2]?.groups[0]?.links.map((link) => link.href)).toContain(teachers);
    expect(all.sections[3]?.groups[2]?.links.map((link) => link.href)).not.toContain(erasmus);
    expect(
      visibleGroups(audiencePanels, new Set([teachers]))[2]?.links.map((link) => link.href),
    ).toContain(teachers);
    expect(isRoutablePagePath(erasmus)).toBe(false);
    expect(isRoutablePagePath(teachers)).toBe(true);
  });

  it("hides a section whose destination is not available", ({ expect }) => {
    const procurement = "/zamowienia-publiczne";
    const [candidates, ...rest] = fallbackNavigation.sections;
    if (candidates === undefined) {
      throw new Error("The candidates section is missing");
    }
    const unavailable = {
      ...fallbackNavigation,
      sections: [{ ...candidates, href: procurement }, ...rest],
    };
    expect(visibleNavigation(unavailable, new Set()).sections.map((s) => s.id)).not.toContain(
      "kandydaci",
    );
    expect(
      visibleNavigation(unavailable, new Set([procurement])).sections.map((s) => s.id),
    ).toContain("kandydaci");
    const broken = {
      ...fallbackNavigation,
      sections: [{ ...candidates, href: "/szkola/projekty/erasmus" }, ...rest],
    };
    expect(
      visibleNavigation(broken, new Set(["/szkola/projekty/erasmus"])).sections.map((s) => s.id),
    ).not.toContain("kandydaci");
  });

  it("guards link destinations through the shared rule", ({ expect }) => {
    expect(isVisibleHref("/zamowienia-publiczne", new Set())).toBe(false);
    expect(isVisibleHref("/zamowienia-publiczne", new Set(["/zamowienia-publiczne"]))).toBe(true);
    expect(isVisibleHref("/szkola/projekty/erasmus", new Set(["/szkola/projekty/erasmus"]))).toBe(
      false,
    );
    expect(isVisibleHref("/kandydaci/rekrutacja", new Set())).toBe(true);
    expect(isVisibleHref("https://www.bip.krakow.pl/?bip_id=269", new Set())).toBe(true);
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
