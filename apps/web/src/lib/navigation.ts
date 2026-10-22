export interface NavLink {
  readonly label: string;
  readonly href: string;
  readonly external?: true;
}

export interface NavGroup {
  readonly title: string;
  readonly links: readonly NavLink[];
}

export type Featured = "professions" | "live-status" | "next-meeting" | "patron";

export interface NavSection {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly groups: readonly NavGroup[];
  readonly featured?: Featured;
}

export function sectionFor(sections: readonly NavSection[], path: string): NavSection | undefined {
  return sections.find((section) => path === section.href || path.startsWith(`${section.href}/`));
}
