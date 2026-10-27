import { z } from "zod";

import { slugSchema } from "./content.ts";

const line = (max: number): z.ZodString => z.string().trim().min(1).max(max);

export const fieldSchema = z.enum([
  "informatyka",
  "mechatronika",
  "motoryzacja",
  "lotnictwo",
  "logistyka",
]);

export const schoolSchema = z.enum(["technikum", "branzowa-1", "branzowa-2"]);

const qualificationSchema = z.strictObject({ code: line(12), name: line(160) });

const topicSchema = z.strictObject({ title: line(120), text: line(400) });

export const professionSchema = z.strictObject({
  slug: slugSchema.max(80),
  name: line(120),
  field: fieldSchema,
  topics: z.array(line(60)).max(12),
  qualifications: z.array(qualificationSchema).min(1).max(4),
  paths: z
    .array(z.strictObject({ school: schoolSchema, years: z.int().min(1).max(6) }))
    .min(1)
    .max(3),
});

export const programmeSchema = z.strictObject({
  slug: slugSchema.max(80),
  profession: slugSchema.max(80),
  school: schoolSchema,
  lead: line(400),
  learn: z.array(topicSchema).min(1).max(12),
  tools: z.array(line(80)).max(20),
  practice: z.array(line(300)).max(12),
  exams: z
    .array(
      qualificationSchema.extend({ scope: line(300), alternative: qualificationSchema.optional() }),
    )
    .max(4),
  careers: z.array(topicSchema).max(12),
  entry: line(400).optional(),
  drivingLicence: z.enum(["A", "B"]).optional(),
  erasmus: z.boolean(),
});

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const programmesSchema = z
  .strictObject({
    professions: z.array(professionSchema).min(1).max(40),
    programmes: z.array(programmeSchema).min(1).max(60),
  })
  .refine((data) => unique(data.professions.map((profession) => profession.slug)), {
    message: "Profession addresses are unique",
    path: ["professions"],
  })
  .refine((data) => unique(data.programmes.map((programme) => programme.slug)), {
    message: "Programme addresses are unique",
    path: ["programmes"],
  })
  .refine(
    (data) =>
      data.programmes.every((programme) =>
        data.professions.some((profession) => profession.slug === programme.profession),
      ),
    { message: "Programmes belong to listed professions", path: ["programmes"] },
  );

export type Profession = z.infer<typeof professionSchema>;
export type Programme = z.infer<typeof programmeSchema>;
export type Programmes = z.infer<typeof programmesSchema>;
