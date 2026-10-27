import { describe, it } from "vitest";
import type { z } from "zod";

import { announcementInputSchema, announcementSeveritySchema } from "../src/announcements.ts";
import {
  bellLessonSchema,
  bellLessonsSchema,
  bellScheduleSchema,
  bellVariantSchema,
} from "../src/bells.ts";
import {
  panelEventSaveSchema,
  panelFileViewSchema,
  panelMutationSchema,
  panelRedirectFromSchema,
  panelStaffEmailSchema,
} from "../src/panel.ts";

function firstIssue(
  schema: z.ZodType,
  value: unknown,
): { message: string; path: PropertyKey[] } | undefined {
  const parsed = schema.safeParse(value);
  const issue = parsed.success ? undefined : parsed.error.issues[0];
  return issue === undefined ? undefined : { message: issue.message, path: issue.path };
}

const LESSON = { start: "08:00", end: "08:45" };
const SCHEDULE = {
  regular: [LESSON],
  variants: [{ id: "a", label: "A", lessons: [LESSON] }],
  days: [{ date: "2026-10-30", variant: "a" }],
};
const ANNOUNCEMENT = {
  severity: "info",
  text: "Tekst",
  startsOn: "2026-10-26",
  endsOn: "2026-10-26",
};

describe("announcement guards", () => {
  it("names every severity", ({ expect }) => {
    expect(announcementSeveritySchema.options).toEqual(["info", "important", "urgent"]);
  });

  it("anchors external links and trims the link label", ({ expect }) => {
    const withHref = (href: string): boolean =>
      announcementInputSchema.safeParse({ ...ANNOUNCEMENT, link: { label: "A", href } }).success;
    expect(withHref("https://krakow.pl")).toBe(true);
    expect(withHref("zobacz https://krakow.pl")).toBe(false);
    expect(withHref("https://krakow.pl x")).toBe(false);
    expect(
      announcementInputSchema.parse({ ...ANNOUNCEMENT, link: { label: " A ", href: "/kontakt" } })
        .link?.label,
    ).toBe("A");
  });

  it("explains a reversed period on the last day", ({ expect }) => {
    expect(firstIssue(announcementInputSchema, { ...ANNOUNCEMENT, endsOn: "2026-10-25" })).toEqual({
      message: "The last day cannot precede the first",
      path: ["endsOn"],
    });
  });
});

describe("bell guards", () => {
  it("anchors lesson times", ({ expect }) => {
    expect(bellLessonSchema.safeParse({ start: "08:00", end: "x09:00" }).success).toBe(false);
    expect(bellLessonSchema.safeParse({ start: "08:00x", end: "08:45" }).success).toBe(false);
  });

  it("explains reversed and overlapping lessons", ({ expect }) => {
    expect(firstIssue(bellLessonSchema, { start: "09:00", end: "08:00" })).toEqual({
      message: "A lesson ends after it starts",
      path: ["end"],
    });
    expect(firstIssue(bellLessonsSchema, [LESSON, { start: "08:30", end: "09:00" }])).toEqual({
      message: "Lessons follow one another without overlapping",
      path: [],
    });
  });

  it("trims variant names", ({ expect }) => {
    expect(bellVariantSchema.parse({ id: "a", label: " A ", lessons: [LESSON] }).label).toBe("A");
  });

  it("explains schedule inconsistencies", ({ expect }) => {
    expect(
      firstIssue(bellScheduleSchema, {
        ...SCHEDULE,
        variants: [...SCHEDULE.variants, ...SCHEDULE.variants],
      }),
    ).toEqual({ message: "Variant identifiers are unique", path: ["variants"] });
    expect(
      firstIssue(bellScheduleSchema, { ...SCHEDULE, days: [...SCHEDULE.days, ...SCHEDULE.days] }),
    ).toEqual({ message: "Each day has one variant", path: ["days"] });
    expect(
      firstIssue(bellScheduleSchema, {
        ...SCHEDULE,
        days: [...SCHEDULE.days, { date: "2026-10-31", variant: "b" }],
      }),
    ).toEqual({ message: "Days use defined variants", path: ["days"] });
    expect(
      bellScheduleSchema.safeParse({
        ...SCHEDULE,
        variants: [...SCHEDULE.variants, { id: "b", label: "B", lessons: [LESSON] }],
        days: [{ date: "2026-10-31", variant: "b" }],
      }).success,
    ).toBe(true);
  });
});

describe("panel guards", () => {
  it("anchors staff e-mail addresses", ({ expect }) => {
    expect(panelStaffEmailSchema.safeParse("a@zsm3.pl").success).toBe(true);
    expect(panelStaffEmailSchema.safeParse("a@b.zsm3.pl").success).toBe(true);
    expect(panelStaffEmailSchema.safeParse("x y@zsm3.pl").success).toBe(false);
    expect(panelStaffEmailSchema.safeParse("a@zsm3.pl x").success).toBe(false);
  });

  it("anchors old addresses for redirects", ({ expect }) => {
    expect(panelRedirectFromSchema.safeParse("/").success).toBe(true);
    expect(panelRedirectFromSchema.safeParse("/stara/podstrona").success).toBe(true);
    expect(panelRedirectFromSchema.safeParse("x/stara").success).toBe(false);
    expect(panelRedirectFromSchema.safeParse("/stara podstrona").success).toBe(false);
    expect(panelRedirectFromSchema.safeParse(`/${"a".repeat(500)}`).success).toBe(false);
  });

  it("documents why an empty school year is allowed", ({ expect }) => {
    expect(panelEventSaveSchema.shape.events.description).toBe(
      "Lower bound of zero lets an empty list clear the whole school year",
    );
  });

  it("wraps a single stored file", ({ expect }) => {
    expect(panelFileViewSchema.safeParse({}).success).toBe(false);
  });

  it("accepts one example of every mutation", ({ expect }) => {
    const examples: readonly unknown[] = [
      { entity: "news", mutation: { action: "publish" } },
      {
        entity: "pages",
        action: "save",
        status: "draft",
        page: {
          path: "/kontakt",
          kicker: "Szkoła",
          title: "Kontakt",
          intro: "Wstęp.",
          sections: [
            {
              id: "opis",
              title: "Opis",
              blocks: [{ type: "callout", title: "Uwaga", text: "Tekst." }],
            },
          ],
        },
      },
      { entity: "events", events: [] },
      { entity: "redirects", item: { from: "/a", to: "/kontakt" } },
      { entity: "staff", item: { email: "a@zsm3.pl", role: "editor", active: true } },
      { entity: "announcements", item: ANNOUNCEMENT },
      { entity: "bells", schedule: SCHEDULE },
      { entity: "revisions", target: "pages", id: "/kontakt", revision: 1 },
    ];
    for (const example of examples) {
      expect(panelMutationSchema.parse(example)).toEqual(example);
    }
    expect(panelMutationSchema.safeParse({ entity: "", item: ANNOUNCEMENT }).success).toBe(false);
  });
});
