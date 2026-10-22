import { describe, it } from "vitest";

import { professions } from "../src/data/professions.ts";
import { programmes } from "../src/data/programmes/index.ts";
import type { Profession } from "../src/lib/professions.ts";
import {
  examCodes,
  isSchoolFilter,
  matchesSchool,
  professionOf,
  programmeFacts,
  programmeFaq,
  programmeHref,
  schoolNames,
  schoolYears,
  siblingProgrammes,
  yearsLabel,
  type Programme,
} from "../src/lib/programmes.ts";

function programme(slug: string): Programme {
  const found = programmes.find((item) => item.slug === slug);
  if (found === undefined) {
    throw new Error(`missing ${slug}`);
  }
  return found;
}

function professionFor(item: Programme): Profession {
  return professionOf(professions, item);
}

describe("programme data", () => {
  it("has fifteen programmes with unique slugs", ({ expect }) => {
    expect(programmes).toHaveLength(15);
    expect(new Set(programmes.map((item) => item.slug)).size).toBe(15);
  });

  it("matches every study path of every profession exactly once", ({ expect }) => {
    const fromProgrammes = programmes.map((item) => `${item.profession}:${item.school}`).toSorted();
    const fromProfessions = professions
      .flatMap((profession) => profession.paths.map((path) => `${profession.slug}:${path.school}`))
      .toSorted();

    expect(fromProgrammes).toEqual(fromProfessions);
  });

  it("describes what is taught and the exams for every programme", ({ expect }) => {
    for (const item of programmes) {
      expect(item.learn.length, item.slug).toBeGreaterThanOrEqual(6);
      expect(item.exams.length, item.slug).toBeGreaterThan(0);
      expect(item.lead.length, item.slug).toBeGreaterThan(40);
    }
  });

  it("states the entry requirement only for second-stage programmes", ({ expect }) => {
    for (const item of programmes) {
      expect(item.entry !== undefined, item.slug).toBe(item.school === "branzowa-2");
    }
  });
});

describe("programme helpers", () => {
  it("names schools and their length", ({ expect }) => {
    expect(schoolNames.technikum).toBe("Technikum Mechaniczne nr 17");
    expect(schoolNames["branzowa-2"]).toBe("Branżowa Szkoła II stopnia nr 9");
    expect(schoolYears).toEqual({ technikum: 5, "branzowa-1": 3, "branzowa-2": 2 });
    expect(yearsLabel(2)).toBe("2 lata");
    expect(yearsLabel(5)).toBe("5 lat");
  });

  it("filters by school", ({ expect }) => {
    expect(isSchoolFilter("wszystkie")).toBe(true);
    expect(isSchoolFilter("branzowa-1")).toBe(true);
    expect(isSchoolFilter("liceum")).toBe(false);
    expect(isSchoolFilter(undefined)).toBe(false);
    expect(matchesSchool("technikum", "wszystkie")).toBe(true);
    expect(matchesSchool("technikum", "technikum")).toBe(true);
    expect(matchesSchool("technikum", "branzowa-2")).toBe(false);
  });

  it("links programmes and joins exam codes", ({ expect }) => {
    const car = programme("technik-pojazdow-samochodowych");

    expect(programmeHref(car)).toBe("/kandydaci/zawody/technik-pojazdow-samochodowych");
    expect(examCodes(car)).toBe("MOT.05 / MOT.02 + MOT.06");
    expect(examCodes(programme("technik-awionik"))).toBe("TLO.01");
  });

  it("rejects programmes of unknown professions", ({ expect }) => {
    expect(() => professionOf([], programme("technik-awionik"))).toThrow(
      "Unknown profession: technik-awionik",
    );
  });

  it("highlights the driving licence, then Erasmus+, then the field", ({ expect }) => {
    const facts = (slug: string): unknown => {
      const item = programme(slug);
      return programmeFacts(item, professionFor(item));
    };

    expect(facts("mechanik-motocyklowy")).toEqual([
      { value: "3 lata", label: "nauki: Branżowa I stopnia" },
      { value: "MOT.04", label: "egzamin zawodowy" },
      { value: "Prawo jazdy A", label: "bezpłatny kurs" },
    ]);
    expect(facts("technik-programista")).toContainEqual({
      value: "Erasmus+",
      label: "praktyki za granicą",
    });
    expect(facts("technik-robotyk")).toEqual([
      { value: "5 lat", label: "nauki: Technikum" },
      { value: "ELM.07 + ELM.08", label: "egzaminy zawodowe" },
      { value: "Mechatronika i robotyka", label: "branża" },
    ]);
  });

  it("answers the usual questions from the programme data", ({ expect }) => {
    const car = programme("technik-pojazdow-samochodowych");
    const faq = programmeFaq(car, professionFor(car));

    expect(faq.map((item) => item.question)).toEqual([
      "Ile trwa nauka?",
      "Jakie egzaminy zawodowe zdaję?",
      "Kto może się zapisać?",
      "Czy w trakcie nauki zrobię prawo jazdy?",
    ]);
    expect(faq[0]?.answer).toBe(
      "5 lat w szkole Technikum Mechaniczne nr 17. Nauka kończy się egzaminem maturalnym i dyplomem technika po zdaniu egzaminów zawodowych.",
    );
    expect(faq[1]?.answer).toBe(
      "MOT.05 (Mechanika samochodowa) lub MOT.02 (Mechatronika samochodowa), MOT.06 (Organizacja obsługi pojazdów). Komplet kwalifikacji daje dyplom w zawodzie technik pojazdów samochodowych.",
    );
    expect(faq[2]?.answer).toBe("Absolwenci szkoły podstawowej.");
    expect(faq[3]?.answer).toBe(
      "Tak. Uczniowie korzystają z bezpłatnego kursu prawa jazdy kategorii B.",
    );
  });

  it("explains what comes after each school", ({ expect }) => {
    const firstAnswer = (slug: string): string | undefined => {
      const item = programme(slug);
      return programmeFaq(item, professionFor(item))[0]?.answer;
    };

    expect(firstAnswer("mechanik-pojazdow-samochodowych")).toBe(
      "3 lata w szkole Branżowa Szkoła I stopnia nr 17. Po szkole możesz pracować w zawodzie albo kontynuować naukę w branżowej szkole II stopnia.",
    );
    expect(firstAnswer("technik-elektromobilnosci-branzowa-ii")).toBe(
      "2 lata w szkole Branżowa Szkoła II stopnia nr 9. Po ukończeniu szkoły możesz przystąpić do egzaminu maturalnego.",
    );
  });

  it("mentions Erasmus+ only where the school offers it", ({ expect }) => {
    const questions = (slug: string): readonly string[] => {
      const item = programme(slug);
      return programmeFaq(item, professionFor(item)).map((entry) => entry.question);
    };

    const avionics = programme("technik-awionik");

    expect(programmeFaq(avionics, professionFor(avionics)).at(-1)).toEqual({
      question: "Czy mogę odbyć praktyki za granicą?",
      answer: "Tak. Szkoła organizuje zagraniczne praktyki zawodowe w programie Erasmus+.",
    });
    expect(questions("technik-robotyk")).not.toContain("Czy mogę odbyć praktyki za granicą?");
    expect(questions("technik-robotyk")).not.toContain("Czy w trakcie nauki zrobię prawo jazdy?");
  });

  it("lists other programmes of the same field", ({ expect }) => {
    const siblings = siblingProgrammes(programmes, professions, programme("technik-awionik"));

    expect(siblings.map((item) => item.slug)).toEqual([
      "technik-mechanik-lotniczy",
      "technik-lotniskowych-sluzb-operacyjnych",
    ]);
  });
});
