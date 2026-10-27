import { z } from "zod";

import { isoDateSchema, slugSchema } from "./content.ts";

export const MAX_BELL_LESSONS = 16;
export const MAX_BELL_VARIANTS = 20;
export const MAX_BELL_DAYS = 366;

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

const timeSchema = z.string().regex(TIME);

export const bellLessonSchema = z
  .strictObject({ start: timeSchema, end: timeSchema })
  .refine((lesson) => lesson.start < lesson.end, {
    message: "A lesson ends after it starts",
    path: ["end"],
  });

export const bellLessonsSchema = z
  .array(bellLessonSchema)
  .min(1)
  .max(MAX_BELL_LESSONS)
  .refine(
    (lessons) =>
      lessons.reduce(
        (order, lesson) => ({ ok: order.ok && order.end <= lesson.start, end: lesson.end }),
        { ok: true, end: "00:00" },
      ).ok,
    { message: "Lessons follow one another without overlapping" },
  );

export const bellVariantSchema = z.strictObject({
  id: slugSchema.max(60),
  label: z.string().trim().min(1).max(120),
  lessons: bellLessonsSchema,
});

export const bellDaySchema = z.strictObject({ date: isoDateSchema, variant: slugSchema.max(60) });

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const bellScheduleSchema = z
  .strictObject({
    regular: bellLessonsSchema,
    variants: z.array(bellVariantSchema).max(MAX_BELL_VARIANTS),
    days: z.array(bellDaySchema).max(MAX_BELL_DAYS),
  })
  .refine((schedule) => unique(schedule.variants.map((variant) => variant.id)), {
    message: "Variant identifiers are unique",
    path: ["variants"],
  })
  .refine((schedule) => unique(schedule.days.map((day) => day.date)), {
    message: "Each day has one variant",
    path: ["days"],
  })
  .refine(
    (schedule) =>
      schedule.days.every((day) => schedule.variants.some((variant) => variant.id === day.variant)),
    { message: "Days use defined variants", path: ["days"] },
  );

export const bellScheduleViewSchema = z.strictObject({ schedule: bellScheduleSchema });

export type BellLesson = z.infer<typeof bellLessonSchema>;
export type BellVariantDefinition = z.infer<typeof bellVariantSchema>;
export type BellDay = z.infer<typeof bellDaySchema>;
export type BellSchedule = z.infer<typeof bellScheduleSchema>;
