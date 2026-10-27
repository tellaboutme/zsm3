import { it } from "vitest";

import {
  AUDIENCES,
  eventsFrom,
  rowFor,
  schoolYearFor,
  yearChoices,
} from "../src/lib/panel/events.ts";

const MAY = new Date("2026-05-14T12:00:00Z");
const AUGUST = new Date("2026-08-02T12:00:00Z");

it("places dates in the school year", ({ expect }) => {
  expect(schoolYearFor(MAY)).toBe(2025);
  expect(schoolYearFor(AUGUST)).toBe(2026);
  expect(schoolYearFor(new Date("2026-07-16T00:00:00Z"))).toBe(2025);
});

it("offers the current year and the three neighbouring ones", ({ expect }) => {
  expect(yearChoices(MAY)).toEqual([2026, 2025, 2024, 2023]);
  expect(yearChoices(AUGUST)).toEqual([2027, 2026, 2025, 2024]);
});

it("keeps every event field for the editor row", ({ expect }) => {
  const row = rowFor({
    date: "2026-09-01",
    endDate: "2026-09-02",
    title: "Pasowanie",
    audience: "Uczniowie",
    kind: "uroczystosc",
    note: "Sala gimnastyczna",
    key: true,
  });
  expect(row).toEqual({
    date: "2026-09-01",
    endDate: "2026-09-02",
    title: "Pasowanie",
    audience: "Uczniowie",
    kind: "uroczystosc",
    note: "Sala gimnastyczna",
    key: true,
  });
  expect(
    rowFor({ date: "2026-09-01", title: "Egzamin", audience: "Rodzice", kind: "egzamin" }),
  ).toEqual({
    date: "2026-09-01",
    endDate: "",
    title: "Egzamin",
    audience: "Rodzice",
    kind: "egzamin",
    note: "",
    key: false,
  });
});

it("collects complete rows and drops partial ones", ({ expect }) => {
  const rows = [
    {
      date: " 2026-11-11 ",
      endDate: "",
      title: " Święto ",
      audience: "Wszyscy",
      kind: "wolne",
      note: "",
      key: false,
    },
    { date: "", endDate: "", title: "", audience: "", kind: "", note: "", key: false },
    {
      date: "2026-12-19",
      endDate: "2027-01-03",
      title: "Przerwa",
      audience: "",
      kind: "przerwa",
      note: "Ferie",
      key: true,
    },
    {
      date: "2026-02-03",
      endDate: "",
      title: "Zebrało",
      audience: "Nieznani",
      kind: "lokaj",
      note: "",
      key: false,
    },
  ];
  expect(eventsFrom(rows)).toEqual([
    { date: "2026-11-11", title: "Święto", audience: "Wszyscy", kind: "wolne" },
    {
      date: "2026-12-19",
      title: "Przerwa",
      audience: "Wszyscy",
      kind: "przerwa",
      endDate: "2027-01-03",
      note: "Ferie",
      key: true,
    },
    { date: "2026-02-03", title: "Zebrało", audience: "Wszyscy", kind: "zebranie" },
  ]);
  expect(eventsFrom([])).toEqual([]);
});

it("keeps the audience literal set", ({ expect }) => {
  expect([...AUDIENCES]).toEqual(["Wszyscy", "Uczniowie", "Rodzice"]);
});
