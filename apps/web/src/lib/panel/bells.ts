import {
  bellLessonSchema,
  bellLessonsSchema,
  bellScheduleSchema,
  type BellLesson,
  type BellSchedule,
} from "@zsm3/contracts/bells";

import { slugify } from "./slug.ts";

export interface VariantDraft {
  readonly key: string;
  readonly label: string;
  readonly text: string;
}

export interface DayDraft {
  readonly date: string;
  readonly key: string;
}

export interface ScheduleFields {
  readonly regular: string;
  readonly variants: readonly VariantDraft[];
  readonly days: readonly DayDraft[];
  readonly saved: ReadonlySet<string>;
}

export type Drafted<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problem: string };

const LINE = /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/u;
const SPACES = /\s+/gu;
const DASHES = /[–—]/gu;
const DOTS = /\./gu;

export function lessonsText(lessons: readonly BellLesson[]): string {
  return lessons.map((lesson) => `${lesson.start}–${lesson.end}`).join("\n");
}

function lessonOf(line: string): BellLesson | undefined {
  const normalized = line.replace(SPACES, "").replace(DASHES, "-").replace(DOTS, ":");
  if (!LINE.test(normalized)) {
    return undefined;
  }
  const [start, end] = normalized.split("-").map((time) => time.padStart(5, "0"));
  const parsed = bellLessonSchema.safeParse({ start, end });
  return parsed.success ? parsed.data : undefined;
}

export function parseLessons(text: string, name: string): Drafted<BellLesson[]> {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return { ok: false, problem: `${name}: wpisz co najmniej jedną lekcję.` };
  }
  const lessons: BellLesson[] = [];
  for (const [index, line] of lines.entries()) {
    const lesson = lessonOf(line);
    if (lesson === undefined) {
      return {
        ok: false,
        problem: `${name}, wiersz ${String(index + 1)}: wpisz godziny jak 07:30–08:15.`,
      };
    }
    lessons.push(lesson);
  }
  if (!bellLessonsSchema.safeParse(lessons).success) {
    return { ok: false, problem: `${name}: lekcje nachodzą na siebie albo jest ich za dużo.` };
  }
  return { ok: true, value: lessons };
}

export interface NamedVariant {
  readonly variant: VariantDraft;
  readonly id: string;
}

export function variantIds(
  variants: readonly VariantDraft[],
  saved: ReadonlySet<string>,
): readonly NamedVariant[] {
  const taken = new Set(variants.map((variant) => variant.key).filter((key) => saved.has(key)));
  return variants.map((variant) => {
    if (saved.has(variant.key)) {
      return { variant, id: variant.key };
    }
    const slug = slugify(variant.label).slice(0, 50);
    const base = slug === "" ? "wariant" : slug;
    let id = base;
    for (let suffix = 2; taken.has(id); suffix += 1) {
      id = `${base}-${String(suffix)}`;
    }
    taken.add(id);
    return { variant, id };
  });
}

function draftVariants(named: readonly NamedVariant[]): Drafted<BellSchedule["variants"]> {
  const result: BellSchedule["variants"] = [];
  for (const { variant, id } of named) {
    const label = variant.label.trim();
    if (label.length === 0) {
      return { ok: false, problem: "Każdy wariant potrzebuje nazwy." };
    }
    const lessons = parseLessons(variant.text, label);
    if (!lessons.ok) {
      return lessons;
    }
    result.push({ id, label, lessons: lessons.value });
  }
  return { ok: true, value: result };
}

function draftDays(
  days: readonly DayDraft[],
  ids: ReadonlyMap<string, string>,
): Drafted<BellSchedule["days"]> {
  const result: BellSchedule["days"] = [];
  for (const day of days) {
    const variant = ids.get(day.key);
    if (day.date === "" || variant === undefined) {
      return { ok: false, problem: "Każdy dzień potrzebuje daty i wariantu." };
    }
    result.push({ date: day.date, variant });
  }
  return { ok: true, value: result };
}

export function scheduleDraft(fields: ScheduleFields): Drafted<BellSchedule> {
  const regular = parseLessons(fields.regular, "Zwykły plan");
  if (!regular.ok) {
    return regular;
  }
  const named = variantIds(fields.variants, fields.saved);
  const variants = draftVariants(named);
  if (!variants.ok) {
    return variants;
  }
  const days = draftDays(fields.days, new Map(named.map(({ variant, id }) => [variant.key, id])));
  if (!days.ok) {
    return days;
  }
  const parsed = bellScheduleSchema.safeParse({
    regular: regular.value,
    variants: variants.value,
    days: days.value,
  });
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, problem: "Ten sam dzień wpisano dwa razy." };
}
