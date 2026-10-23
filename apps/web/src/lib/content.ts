import type { ContentBlock, ContentPage } from "@zsm3/contracts/content";

import type { NavLink, NavSection } from "./navigation.ts";

export type { ContentBlock, ContentPage };

export type ContentSection = ContentPage["sections"][number];

export type TimelineItem = Extract<ContentBlock, { type: "timeline" }>["items"][number];

export const IN_PAGE_NAV_MIN_SECTIONS = 4;

export function needsInPageNav(page: ContentPage): boolean {
  return page.sections.length >= IN_PAGE_NAV_MIN_SECTIONS;
}

export function siblingLinks(sections: readonly NavSection[], path: string): readonly NavLink[] {
  const group = sections
    .flatMap((section) => section.groups)
    .find((candidate) => candidate.links.some((link) => link.href === path));
  return group?.links.filter((link) => link.href !== path) ?? [];
}

export function sectionTitleFor(
  sections: readonly NavSection[],
  path: string,
): NavLink | undefined {
  const section = sections.find((candidate) => path.startsWith(`${candidate.href}/`));
  return section === undefined ? undefined : { label: section.label, href: section.href };
}
