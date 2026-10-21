import { z } from "zod";

export const PROBLEM_CONTENT_TYPE = "application/problem+json";

export const problemDetailsSchema = z.strictObject({
  type: z.string().min(1),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  detail: z.string().min(1).optional(),
  requestId: z.uuid(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
