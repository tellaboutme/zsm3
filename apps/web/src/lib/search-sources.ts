import { plainText } from "@zsm3/contracts/rich-text";

import type { ContentBlock, ContentPage } from "./content.ts";
import type { Lesson } from "./live-status.ts";
import type { StaffGroup } from "./people.ts";
import { personLine } from "./people.ts";
import type { SearchEntry } from "./search.ts";

export interface ClassRoomSource {
  readonly name: string;
  readonly room: string;
}

export interface GradeSource {
  readonly grade: string;
  readonly classes: readonly ClassRoomSource[];
}

export interface ContactSource {
  readonly title: string;
  readonly role: string;
  readonly phones: readonly { readonly label: string }[];
  readonly emails: readonly string[];
}

function blockText(block: ContentBlock): string {
  switch (block.type) {
    case "rich-text":
      return plainText(block.document);
    case "facts":
      return [block.label, ...block.facts.map((fact) => `${fact.value} ${fact.label}`)].join(" ");
    case "timeline":
      return block.items.map((item) => `${item.label} ${item.title} ${item.text}`).join(" ");
    case "callout":
      return `${block.title} ${block.text}`;
  }
}

export function contentPageEntry(page: ContentPage): SearchEntry {
  const sections = page.sections.map((section) =>
    [section.title, ...section.blocks.map(blockText)].join(" "),
  );
  return {
    type: "strona",
    title: page.title,
    href: page.path,
    text: [page.intro, ...sections].join(" "),
  };
}

export function classEntries(
  grades: readonly GradeSource[],
  meeting: string,
): readonly SearchEntry[] {
  return grades.flatMap((grade) =>
    grade.classes.map((entry) => ({
      type: "klasa" as const,
      title: `Klasa ${entry.name}`,
      href: "/rodzice/wywiadowki",
      text: `Sala ${entry.room}. ${grade.grade}. Zebranie z rodzicami ${meeting}.`,
    })),
  );
}

export function contactEntry(card: ContactSource): SearchEntry {
  return {
    type: "kontakt",
    title: card.title,
    href: "/kontakt",
    text: [card.role, ...card.phones.map((phone) => `tel. ${phone.label}`), ...card.emails].join(
      " · ",
    ),
  };
}

export function staffEntry(group: StaffGroup): SearchEntry {
  return {
    type: "kontakt",
    title: `Kadra: ${group.title}`,
    href: `/szkola/kadra#${group.id}`,
    text: [group.summary, ...group.subjects, ...group.people.map(personLine)].join(" · "),
  };
}

export function bellsEntry(lessons: readonly Lesson[]): SearchEntry {
  return {
    type: "strona",
    title: "Dzwonki: godziny lekcji i przerw",
    href: "/uczniowie/dzwonki",
    text: lessons
      .map((lesson) => `Lekcja ${String(lesson.number)}: ${lesson.start}–${lesson.end}`)
      .join(" · "),
  };
}
