import type { RichText } from "@zsm3/contracts/rich-text";

import type { NavLink, NavSection } from "./navigation.ts";
import type { Fact } from "./programmes.ts";

export interface TimelineItem {
  readonly label: string;
  readonly title: string;
  readonly text: string;
}

export type ContentBlock =
  | { readonly type: "rich-text"; readonly document: RichText }
  | { readonly type: "facts"; readonly label: string; readonly facts: readonly Fact[] }
  | { readonly type: "timeline"; readonly items: readonly TimelineItem[] }
  | {
      readonly type: "callout";
      readonly title: string;
      readonly text: string;
      readonly link?: NavLink;
    };

export interface ContentSection {
  readonly id: string;
  readonly title: string;
  readonly blocks: readonly ContentBlock[];
}

export interface ContentPage {
  readonly path: string;
  readonly kicker: string;
  readonly title: string;
  readonly intro: string;
  readonly sections: readonly ContentSection[];
}

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
