import { it } from "vitest";

import { lessonsText, parseLessons, scheduleDraft, variantIds } from "../src/lib/panel/bells.ts";

const REGULAR = "7:30 - 8:15\n08.20–09.05\n\n";

it("writes and reads lessons one per line", ({ expect }) => {
  const parsed = parseLessons(REGULAR, "Zwykły plan");
  expect(parsed).toEqual({
    ok: true,
    value: [
      { start: "07:30", end: "08:15" },
      { start: "08:20", end: "09:05" },
    ],
  });
  expect(lessonsText(parsed.ok ? parsed.value : [])).toBe("07:30–08:15\n08:20–09:05");
});

it("explains which line is wrong", ({ expect }) => {
  expect(parseLessons(" \n", "Zwykły plan")).toEqual({
    ok: false,
    problem: "Zwykły plan: wpisz co najmniej jedną lekcję.",
  });
  expect(parseLessons("07:30–08:15\nósma", "Skrócone")).toEqual({
    ok: false,
    problem: "Skrócone, wiersz 2: wpisz godziny jak 07:30–08:15.",
  });
  expect(parseLessons("25:00–25:45", "A")).toMatchObject({ ok: false });
  expect(parseLessons("08:00–08:45\n08:30–09:15", "A")).toEqual({
    ok: false,
    problem: "A: lekcje nachodzą na siebie albo jest ich za dużo.",
  });
});

it("keeps saved variant identifiers and names new ones uniquely", ({ expect }) => {
  const named = variantIds(
    [
      { key: "skrocone", label: "Skrócone", text: "" },
      { key: "nowy-1", label: "Skrócone", text: "" },
      { key: "nowy-2", label: "Skrócone", text: "" },
      { key: "nowy-3", label: "!!!", text: "" },
    ],
    new Set(["skrocone"]),
  );
  expect(named.map(({ id }) => id)).toEqual(["skrocone", "skrocone-2", "skrocone-3", "wariant"]);
});

it("builds the whole schedule from the form", ({ expect }) => {
  expect(
    scheduleDraft({
      regular: REGULAR,
      variants: [{ key: "nowy-1", label: " Rada pedagogiczna ", text: "07:30–08:00" }],
      days: [{ date: "2026-10-30", key: "nowy-1" }],
      saved: new Set(),
    }),
  ).toEqual({
    ok: true,
    value: {
      regular: [
        { start: "07:30", end: "08:15" },
        { start: "08:20", end: "09:05" },
      ],
      variants: [
        {
          id: "rada-pedagogiczna",
          label: "Rada pedagogiczna",
          lessons: [{ start: "07:30", end: "08:00" }],
        },
      ],
      days: [{ date: "2026-10-30", variant: "rada-pedagogiczna" }],
    },
  });
});

it("stops at the first problem in the form", ({ expect }) => {
  const base = {
    regular: REGULAR,
    variants: [{ key: "a", label: "A", text: "07:30–08:00" }],
    days: [{ date: "2026-10-30", key: "a" }],
    saved: new Set(["a"]),
  };
  expect(scheduleDraft({ ...base, regular: "" })).toMatchObject({ ok: false });
  expect(
    scheduleDraft({ ...base, variants: [{ key: "a", label: " ", text: "07:30–08:00" }] }),
  ).toEqual({
    ok: false,
    problem: "Każdy wariant potrzebuje nazwy.",
  });
  expect(scheduleDraft({ ...base, variants: [{ key: "a", label: "A", text: "x" }] })).toMatchObject(
    {
      ok: false,
    },
  );
  expect(scheduleDraft({ ...base, days: [{ date: "", key: "a" }] })).toEqual({
    ok: false,
    problem: "Każdy dzień potrzebuje daty i wariantu.",
  });
  expect(scheduleDraft({ ...base, days: [{ date: "2026-10-30", key: "b" }] })).toMatchObject({
    ok: false,
  });
  expect(scheduleDraft({ ...base, days: [...base.days, ...base.days] })).toEqual({
    ok: false,
    problem: "Ten sam dzień wpisano dwa razy.",
  });
});
