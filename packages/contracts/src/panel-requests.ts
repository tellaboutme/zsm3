import { z } from "zod";

import { MAX_PANEL_PAGE_SIZE, PANEL_LIST_PAGE_SIZE } from "./panel.ts";
import { panelRequestSummarySchema, requestStatusSchema, type RequestStatus } from "./requests.ts";

export const panelRequestsQuerySchema = z
  .strictObject({
    status: requestStatusSchema.optional(),
    before: z.iso.datetime().optional(),
    beforeId: z.uuid().optional(),
    limit: z
      .string()
      .regex(/^\d+$/u)
      .transform(Number)
      .pipe(z.int().min(1).max(MAX_PANEL_PAGE_SIZE))
      .prefault(String(PANEL_LIST_PAGE_SIZE)),
  })
  .refine((query) => query.beforeId === undefined || query.before !== undefined, {
    path: ["beforeId"],
    message: "beforeId requires before",
  });

export type PanelRequestsQuery = z.infer<typeof panelRequestsQuerySchema>;

export const panelRequestsListSchema = z.strictObject({
  items: z.array(panelRequestSummarySchema).max(MAX_PANEL_PAGE_SIZE),
  nextBefore: z.string().nullable(),
  nextBeforeId: z.uuid().nullable(),
});

export type PanelRequestsList = z.infer<typeof panelRequestsListSchema>;

export const staffTargetStatusSchema = requestStatusSchema.exclude(["submitted", "withdrawn"]);

export const panelRequestTransitionSchema = z.strictObject({
  to: staffTargetStatusSchema,
  expectedStatus: requestStatusSchema,
});

export type PanelRequestTransition = z.infer<typeof panelRequestTransitionSchema>;

export type StaffTargetStatus = z.infer<typeof staffTargetStatusSchema>;

export const requestNextStatuses: Readonly<Record<RequestStatus, readonly RequestStatus[]>> = {
  submitted: ["in_progress", "rejected", "withdrawn"],
  in_progress: ["ready", "rejected", "withdrawn"],
  ready: ["collected", "rejected", "withdrawn"],
  collected: [],
  rejected: [],
  withdrawn: [],
};

export function staffNextStatuses(from: RequestStatus): readonly StaffTargetStatus[] {
  return requestNextStatuses[from].flatMap((to) => {
    const parsed = staffTargetStatusSchema.safeParse(to);
    return parsed.success ? [parsed.data] : [];
  });
}
