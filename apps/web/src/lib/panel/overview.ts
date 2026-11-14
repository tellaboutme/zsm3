import type { PanelStaffRole } from "@zsm3/contracts/panel";

import { questionsPath } from "./questions.ts";
import { requestsPath } from "./requests.ts";

export type OverviewTaskName = "requests" | "questions" | "drafts";

export interface OverviewTask {
  readonly task: OverviewTaskName;
  readonly path: string;
  readonly section: string;
  readonly href: string;
  readonly label: string;
}

export const OVERVIEW_TASKS: readonly OverviewTask[] = [
  {
    task: "requests",
    path: requestsPath("submitted", null),
    section: "/panel/wnioski",
    href: "/panel/wnioski?status=submitted",
    label: "Nowe wnioski",
  },
  {
    task: "questions",
    path: questionsPath("received", null),
    section: "/panel/skrzynka",
    href: "/panel/skrzynka?status=received",
    label: "Nowe pytania w Skrzynce",
  },
  {
    task: "drafts",
    path: "/api/panel/news?status=draft&pageSize=1",
    section: "/panel/aktualnosci",
    href: "/panel/aktualnosci",
    label: "Szkice aktualności",
  },
];

interface RoleSection {
  readonly href: string;
  readonly roles?: readonly PanelStaffRole[];
}

function opens(section: RoleSection, role: string): boolean {
  return section.roles === undefined || section.roles.some((allowed) => allowed === role);
}

export function canOpenOverview(sections: readonly RoleSection[], role: string): boolean {
  return role.length > 0 && sections.some((section) => opens(section, role));
}

export function tasksFor(sections: readonly RoleSection[], role: string): readonly OverviewTask[] {
  return OVERVIEW_TASKS.filter((task) =>
    sections.some((section) => section.href === task.section && opens(section, role)),
  );
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
