import { it } from "vitest";

import {
  announcementDraft,
  announcementState,
  announcementSummary,
  SEVERITY_OPTIONS,
} from "../src/lib/panel/announcements.ts";

const FIELDS = {
  severity: "important",
  text: " Jutro lekcje skrócone. ",
  linkLabel: "",
  linkHref: "",
  startsOn: "2026-10-26",
  endsOn: "2026-10-27",
};

const STORED = {
  id: "01920000-0000-7000-8000-000000000001",
  updatedAt: "2026-10-22T08:00:00.000Z",
  severity: "info",
  text: "Zebranie.",
  startsOn: "2026-10-26",
  endsOn: "2026-10-27",
} as const;

it("offers the three severities", ({ expect }) => {
  expect(SEVERITY_OPTIONS.map((option) => option.value)).toEqual(["info", "important", "urgent"]);
});

it("turns form fields into an announcement", ({ expect }) => {
  expect(announcementDraft(FIELDS)).toEqual({
    ok: true,
    item: {
      severity: "important",
      text: "Jutro lekcje skrócone.",
      startsOn: "2026-10-26",
      endsOn: "2026-10-27",
    },
  });
  expect(
    announcementDraft({ ...FIELDS, linkLabel: " Dzwonki ", linkHref: "/uczniowie/dzwonki" }),
  ).toMatchObject({ ok: true, item: { link: { label: "Dzwonki", href: "/uczniowie/dzwonki" } } });
});

it("explains what is wrong with a draft", ({ expect }) => {
  expect(announcementDraft({ ...FIELDS, linkLabel: "Dzwonki" })).toEqual({
    ok: false,
    problem: "Link wymaga obu pól: tekstu i adresu.",
  });
  expect(announcementDraft({ ...FIELDS, linkHref: "/kontakt" })).toMatchObject({ ok: false });
  expect(announcementDraft({ ...FIELDS, endsOn: "2026-10-25" })).toEqual({
    ok: false,
    problem: "Ostatni dzień nie może być przed pierwszym.",
  });
  expect(announcementDraft({ ...FIELDS, text: " " })).toMatchObject({ ok: false });
  expect(announcementDraft({ ...FIELDS, startsOn: "" })).toMatchObject({ ok: false });
  expect(announcementDraft({ ...FIELDS, endsOn: "" })).toMatchObject({ ok: false });
});

it("tells whether a banner is shown now", ({ expect }) => {
  expect(announcementState(STORED, "2026-10-25")).toBe("planned");
  expect(announcementState(STORED, "2026-10-26")).toBe("active");
  expect(announcementState(STORED, "2026-10-27")).toBe("active");
  expect(announcementState(STORED, "2026-10-28")).toBe("ended");
  expect(announcementSummary(STORED, "2026-10-26")).toBe(
    "Widoczne teraz · 2026-10-26 – 2026-10-27",
  );
  expect(announcementSummary({ ...STORED, endsOn: "2026-10-26" }, "2026-10-30")).toBe(
    "Zakończone · 2026-10-26",
  );
});
