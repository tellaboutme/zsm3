import type { PanelStaffRole } from "@zsm3/contracts/panel";

import { CONTENT_ROLES, QUESTION_ROLES, REQUEST_ROLES, sectionAllowed } from "./gate.ts";

export type OverviewTaskName = "requests" | "questions" | "drafts";

export interface OverviewTask {
  readonly task: OverviewTaskName;
  readonly path: string;
  readonly href: string;
  readonly label: string;
  readonly roles: readonly PanelStaffRole[];
}

export const OVERVIEW_TASKS: readonly OverviewTask[] = [
  {
    task: "requests",
    path: "/api/panel/requests?status=submitted&limit=50",
    href: "/panel/wnioski",
    label: "Nowe wnioski",
    roles: REQUEST_ROLES,
  },
  {
    task: "questions",
    path: "/api/panel/questions?status=received",
    href: "/panel/skrzynka",
    label: "Pytania do odpowiedzi",
    roles: QUESTION_ROLES,
  },
  {
    task: "drafts",
    path: "/api/panel/news?status=draft&pageSize=1",
    href: "/panel/aktualnosci",
    label: "Szkice aktualności",
    roles: CONTENT_ROLES,
  },
];

export function tasksFor(role: string): readonly OverviewTask[] {
  return OVERVIEW_TASKS.filter((task) => task.roles.some((allowed) => allowed === role));
}

export function countLabel(count: number, more: boolean): string {
  return more ? `${String(count)}+` : String(count);
}

export type SectionGroupId = "content" | "people" | "admin";

export interface SectionGroup {
  readonly id: SectionGroupId;
  readonly title: string;
}

export const SECTION_GROUPS: readonly SectionGroup[] = [
  { id: "content", title: "Treści strony" },
  { id: "people", title: "Uczniowie i rodzice" },
  { id: "admin", title: "Administracja" },
];

export function sectionsIn<Section extends { readonly group: SectionGroupId }>(
  sections: readonly Section[],
  group: SectionGroupId,
): readonly Section[] {
  return sections.filter((section) => section.group === group);
}

export function canOpenOverview(
  sections: readonly { readonly roles?: readonly PanelStaffRole[] }[],
  role: string,
): boolean {
  return (
    role.length > 0 && sections.some((section) => sectionAllowed(section.roles?.join(" "), role))
  );
}
