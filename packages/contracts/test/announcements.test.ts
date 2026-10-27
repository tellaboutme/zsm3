import { it } from "vitest";

import {
  announcementInputSchema,
  announcementListSchema,
  announcementSchema,
} from "../src/announcements.ts";

const ITEM = {
  severity: "urgent",
  text: " Szkoła zamknięta. ",
  link: { label: "Komunikat", href: "https://www.krakow.pl/" },
  startsOn: "2026-10-26",
  endsOn: "2026-10-26",
};

it("accepts a one-day announcement with a site or https link", ({ expect }) => {
  expect(announcementInputSchema.parse(ITEM).text).toBe("Szkoła zamknięta.");
  expect(
    announcementInputSchema.safeParse({
      ...ITEM,
      link: { label: "Dzwonki", href: "/uczniowie/dzwonki" },
    }).success,
  ).toBe(true);
});

it("rejects broken announcements", ({ expect }) => {
  for (const item of [
    { ...ITEM, endsOn: "2026-10-25" },
    { ...ITEM, severity: "krytyczne" },
    { ...ITEM, text: "x".repeat(301) },
    { ...ITEM, link: { label: "A", href: "javascript:alert(1)" } },
    { ...ITEM, link: { label: "A", href: "http://example.com" } },
    { ...ITEM, link: { label: "", href: "/kontakt" } },
  ]) {
    expect(announcementInputSchema.safeParse(item).success).toBe(false);
  }
});

it("stores announcements with an identifier and version", ({ expect }) => {
  const stored = { ...ITEM, id: "01920000-0000-7000-8000-000000000001", updatedAt: "2026-10-26" };
  expect(announcementListSchema.parse({ items: [stored] }).items).toHaveLength(1);
  expect(announcementSchema.safeParse({ ...stored, id: "abc" }).success).toBe(false);
  expect(announcementSchema.safeParse({ ...stored, endsOn: "2026-10-01" }).success).toBe(false);
});
