import { describe, it } from "vitest";

import { documentGroups } from "../src/data/documents.ts";
import { staffGroups } from "../src/data/staff.ts";
import {
  documentCount,
  fileSize,
  isSignerFilter,
  matchesSigner,
  signerLabels,
} from "../src/lib/documents.ts";
import { initials, personLine } from "../src/lib/people.ts";

describe("documents", () => {
  it("lists ten forms with unique codes W1–W10", ({ expect }) => {
    const codes = documentGroups.flatMap((group) => group.documents.map((entry) => entry.code));

    expect(documentCount(documentGroups)).toBe(10);
    expect(codes.toSorted((a, b) => Number(a.slice(1)) - Number(b.slice(1)))).toEqual(
      [...Array.from({ length: 10 }).keys()].map((index) => `W${String(index + 1)}`),
    );
  });

  it("links only to PDF files over HTTPS", ({ expect }) => {
    for (const entry of documentGroups.flatMap((group) => group.documents)) {
      expect(entry.href, entry.code).toMatch(/^https:\/\/\S+\.pdf$/u);
    }
  });

  it("formats file sizes in Polish", ({ expect }) => {
    expect(fileSize(61_142)).toBe("60 KB");
    expect(fileSize(100)).toBe("1 KB");
    expect(fileSize(1_048_575)).toBe("1024 KB");
    expect(fileSize(1_048_576)).toBe("1,0 MB");
    expect(fileSize(2_831_155)).toBe("2,7 MB");
  });

  it("filters forms by who submits them", ({ expect }) => {
    expect(isSignerFilter("wszyscy")).toBe(true);
    expect(isSignerFilter("uczen")).toBe(true);
    expect(isSignerFilter("rodzic")).toBe(true);
    expect(isSignerFilter("kazdy")).toBe(false);
    expect(isSignerFilter(undefined)).toBe(false);
    expect(matchesSigner("rodzic", "wszyscy")).toBe(true);
    expect(matchesSigner("kazdy", "uczen")).toBe(true);
    expect(matchesSigner("uczen", "uczen")).toBe(true);
    expect(matchesSigner("rodzic", "uczen")).toBe(false);
  });

  it("names every kind of signer", ({ expect }) => {
    expect(signerLabels).toEqual({
      uczen: "Pełnoletni uczeń",
      rodzic: "Rodzic lub opiekun prawny",
      kazdy: "Uczeń lub absolwent",
    });
  });
});

describe("people", () => {
  it("joins a role with the subjects taught", ({ expect }) => {
    expect(personLine({ role: "Psycholog" })).toBe("Psycholog");
    expect(personLine({ role: "Wicedyrektor", subjects: "wychowanie fizyczne" })).toBe(
      "Wicedyrektor, wychowanie fizyczne",
    );
  });

  it("builds initials from up to two name parts", ({ expect }) => {
    expect(initials("anna nowak")).toBe("AN");
    expect(initials("Maria Kowalska-Nowak")).toBe("MK");
    expect(initials("  Łucja  ")).toBe("Ł");
    expect(initials("  anna   nowak ")).toBe("AN");
  });

  it("keeps staff fixtures free of personal names", ({ expect }) => {
    const people = staffGroups.flatMap((group) => group.people);

    expect(people.length).toBeGreaterThan(0);
    expect(people.every((person) => person.name === undefined)).toBe(true);
    expect(new Set(staffGroups.map((group) => group.id)).size).toBe(staffGroups.length);
  });
});
