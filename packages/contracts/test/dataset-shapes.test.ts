import { describe, it } from "vitest";

import {
  CONTACTS,
  DOCUMENTS,
  FILE,
  MEETINGS,
  NAVIGATION,
  PROFESSIONS,
  PROGRAMME,
  STAFF,
} from "./dataset-fixtures.ts";
import {
  contactsSchema,
  documentsSchema,
  meetingsSchema,
  panelDatasetSaveSchema,
  panelDatasetViewSchema,
  signerSchema,
  staffDirectorySchema,
} from "../src/datasets.ts";
import { featuredSchema, navigationSchema } from "../src/navigation.ts";
import { fieldSchema, programmesSchema, schoolSchema } from "../src/programmes.ts";

describe("dataset shapes", () => {
  it("keeps every field of complete examples", ({ expect }) => {
    expect(staffDirectorySchema.parse(STAFF)).toEqual(STAFF);
    expect(meetingsSchema.parse(MEETINGS)).toEqual(MEETINGS);
    expect(contactsSchema.parse(CONTACTS)).toEqual(CONTACTS);
    expect(documentsSchema.parse(DOCUMENTS)).toEqual(DOCUMENTS);
    expect(navigationSchema.parse(NAVIGATION)).toEqual(NAVIGATION);
    const programmes = {
      professions: PROFESSIONS,
      programmes: [
        PROGRAMME,
        {
          ...PROGRAMME,
          slug: "technik-lotnictwo",
          profession: "technik-lotnictwo",
          drivingLicence: "A",
        },
      ],
    };
    expect(programmesSchema.parse(programmes)).toEqual(programmes);
  });

  it("names every allowed value", ({ expect }) => {
    expect(signerSchema.options).toEqual(["uczen", "rodzic", "kazdy"]);
    expect(fieldSchema.options).toEqual([
      "informatyka",
      "mechatronika",
      "motoryzacja",
      "lotnictwo",
      "logistyka",
    ]);
    expect(schoolSchema.options).toEqual(["technikum", "branzowa-1", "branzowa-2"]);
    expect(featuredSchema.options).toEqual([
      "professions",
      "live-status",
      "next-meeting",
      "patron",
    ]);
  });

  it("trims text in every dataset", ({ expect }) => {
    expect(staffDirectorySchema.parse([{ ...STAFF[0], title: " Kadra " }])[0]?.title).toBe("Kadra");
    expect(
      navigationSchema.parse({ ...NAVIGATION, footerGroups: [{ title: " Stopka ", links: [] }] })
        .footerGroups[0]?.title,
    ).toBe("Stopka");
    expect(
      programmesSchema.parse({
        professions: PROFESSIONS,
        programmes: [{ ...PROGRAMME, lead: " Wstęp. " }],
      }).programmes[0]?.lead,
    ).toBe("Wstęp.");
  });

  it("anchors phone numbers, times, files and links", ({ expect }) => {
    const card = CONTACTS.departments[0];
    const phone = (number: string): boolean =>
      contactsSchema.safeParse({
        ...CONTACTS,
        departments: [{ ...card, phones: [{ number, label: "x" }] }],
      }).success;
    expect(phone("+48126440689")).toBe(true);
    for (const wrong of [
      "x+48126440689",
      "+48126440689x",
      "+4812",
      "+48126440689,",
      "+48126440689,1234567",
      "+48126440689,ab",
    ]) {
      expect(phone(wrong), wrong).toBe(false);
    }
    const time = (value: string): boolean =>
      meetingsSchema.safeParse({ ...MEETINGS, steps: [{ time: value, text: "x" }] }).success;
    expect(time("09:05")).toBe(true);
    expect(time("23:59")).toBe(true);
    for (const wrong of ["x17:00", "17:00x", "24:00", "17:60", "3:00", "1a:00", "17:0a"]) {
      expect(time(wrong), wrong).toBe(false);
    }
    const file = (href: string): boolean =>
      documentsSchema.safeParse([
        { ...DOCUMENTS[0], documents: [{ ...DOCUMENTS[0]?.documents[0], href }] },
      ]).success;
    expect(file(`x${FILE}`)).toBe(false);
    expect(file(`${FILE}/x`)).toBe(false);
    const navLink = (href: string): boolean =>
      navigationSchema.safeParse({ ...NAVIGATION, utilityLinks: [{ label: "x", href }] }).success;
    expect(navLink("/a-b/c-d#e")).toBe(true);
    expect(navLink("/a-")).toBe(false);
    expect(navLink("/a-b/c-")).toBe(false);
    expect(navLink("/a#")).toBe(false);
    expect(navLink("x https://a.pl")).toBe(false);
  });

  it("requires at least one section, qualification and topic", ({ expect }) => {
    expect(navigationSchema.safeParse({ ...NAVIGATION, sections: [] }).success).toBe(false);
    expect(
      programmesSchema.safeParse({
        professions: [{ ...PROFESSIONS[0], qualifications: [] }],
        programmes: [PROGRAMME],
      }).success,
    ).toBe(false);
    expect(
      programmesSchema.safeParse({
        professions: PROFESSIONS,
        programmes: [{ ...PROGRAMME, learn: [] }],
      }).success,
    ).toBe(false);
    expect(
      programmesSchema.safeParse({
        professions: PROFESSIONS,
        programmes: [PROGRAMME, { ...PROGRAMME, slug: "inny", profession: "brak" }],
      }).success,
    ).toBe(false);
    expect(
      programmesSchema.safeParse({
        professions: [{ ...PROFESSIONS[0], paths: [{ school: "technikum", years: 7 }] }],
        programmes: [PROGRAMME],
      }).success,
    ).toBe(false);
  });

  it("carries a dataset to and from the panel", ({ expect }) => {
    const view = { key: "kadra", data: STAFF, updatedAt: "2026-10-26T00:00:00.000Z" };
    expect(panelDatasetViewSchema.parse(view)).toEqual(view);
    expect(panelDatasetViewSchema.safeParse({ ...view, updatedAt: "" }).success).toBe(false);
    const save = { entity: "datasets", key: "kadra", data: STAFF };
    expect(panelDatasetSaveSchema.parse(save)).toEqual(save);
  });
});
