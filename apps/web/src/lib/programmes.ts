import type { Programme } from "@zsm3/contracts/programmes";

import { fieldLabels, schoolLabels, type Profession, type School } from "./professions.ts";

export type { Programme } from "@zsm3/contracts/programmes";

export type Topic = Programme["learn"][number];

export type Exam = Programme["exams"][number];

export type QualificationRef = Pick<Exam, "code" | "name">;

export interface Fact {
  readonly value: string;
  readonly label: string;
}

export interface Question {
  readonly question: string;
  readonly answer: string;
}

export const schoolNames: Readonly<Record<School, string>> = {
  technikum: "Technikum Mechaniczne nr 17",
  "branzowa-1": "Branżowa Szkoła I stopnia nr 17",
  "branzowa-2": "Branżowa Szkoła II stopnia nr 9",
};

export const schoolYears: Readonly<Record<School, number>> = {
  technikum: 5,
  "branzowa-1": 3,
  "branzowa-2": 2,
};

export const schools = [
  "technikum",
  "branzowa-1",
  "branzowa-2",
] as const satisfies readonly School[];

export type SchoolFilter = School | "wszystkie";

export function isSchoolFilter(value: string | undefined): value is SchoolFilter {
  return value === "wszystkie" || schools.some((school) => school === value);
}

export function matchesSchool(school: string | undefined, filter: SchoolFilter): boolean {
  return filter === "wszystkie" || school === filter;
}

export function yearsLabel(years: number): string {
  return `${String(years)} ${years < 5 ? "lata" : "lat"}`;
}

export function programmeHref({ slug }: Programme): string {
  return `/kandydaci/zawody/${slug}`;
}

export function examCodes(programme: Programme): string {
  return programme.exams
    .map((exam) =>
      exam.alternative === undefined ? exam.code : `${exam.code} / ${exam.alternative.code}`,
    )
    .join(" + ");
}

export function professionOf(professions: readonly Profession[], programme: Programme): Profession {
  const profession = professions.find((item) => item.slug === programme.profession);
  if (profession === undefined) {
    throw new RangeError(`Unknown profession: ${programme.profession}`);
  }
  return profession;
}

function highlightFact(programme: Programme, profession: Profession): Fact {
  if (programme.drivingLicence !== undefined) {
    return { value: `Prawo jazdy ${programme.drivingLicence}`, label: "bezpłatny kurs" };
  }
  if (programme.erasmus) {
    return { value: "Erasmus+", label: "praktyki za granicą" };
  }
  return { value: fieldLabels[profession.field], label: "branża" };
}

export function programmeFacts(programme: Programme, profession: Profession): readonly Fact[] {
  const exams = programme.exams.length;
  return [
    {
      value: yearsLabel(schoolYears[programme.school]),
      label: `nauki: ${schoolLabels[programme.school]}`,
    },
    { value: examCodes(programme), label: exams === 1 ? "egzamin zawodowy" : "egzaminy zawodowe" },
    highlightFact(programme, profession),
  ];
}

function finish(school: School): string {
  switch (school) {
    case "technikum":
      return "Nauka kończy się egzaminem maturalnym i dyplomem technika po zdaniu egzaminów zawodowych.";
    case "branzowa-1":
      return "Po szkole możesz pracować w zawodzie albo kontynuować naukę w branżowej szkole II stopnia.";
    case "branzowa-2":
      return "Po ukończeniu szkoły możesz przystąpić do egzaminu maturalnego.";
  }
}

export function programmeFaq(programme: Programme, profession: Profession): readonly Question[] {
  const years = yearsLabel(schoolYears[programme.school]);
  const exams = programme.exams.map((exam) =>
    exam.alternative === undefined
      ? `${exam.code} (${exam.name})`
      : `${exam.code} (${exam.name}) lub ${exam.alternative.code} (${exam.alternative.name})`,
  );
  const questions: Question[] = [
    {
      question: "Ile trwa nauka?",
      answer: `${years} w szkole ${schoolNames[programme.school]}. ${finish(programme.school)}`,
    },
    {
      question: "Jakie egzaminy zawodowe zdaję?",
      answer: `${exams.join(", ")}. Komplet kwalifikacji daje dyplom w zawodzie ${profession.name.toLowerCase()}.`,
    },
    {
      question: "Kto może się zapisać?",
      answer: programme.entry ?? "Absolwenci szkoły podstawowej.",
    },
  ];
  if (programme.drivingLicence !== undefined) {
    questions.push({
      question: "Czy w trakcie nauki zrobię prawo jazdy?",
      answer: `Tak. Uczniowie korzystają z bezpłatnego kursu prawa jazdy kategorii ${programme.drivingLicence}.`,
    });
  }
  if (programme.erasmus) {
    questions.push({
      question: "Czy mogę odbyć praktyki za granicą?",
      answer: "Tak. Szkoła organizuje zagraniczne praktyki zawodowe w programie Erasmus+.",
    });
  }
  return questions;
}

export function siblingProgrammes(
  programmes: readonly Programme[],
  professions: readonly Profession[],
  programme: Programme,
): readonly Programme[] {
  const field = professionOf(professions, programme).field;
  return programmes.filter(
    (item) => item.slug !== programme.slug && professionOf(professions, item).field === field,
  );
}
