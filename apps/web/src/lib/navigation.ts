import type { NavGroup, NavLink, NavSection, Navigation } from "@zsm3/contracts/navigation";

export type { NavGroup, NavLink, NavSection } from "@zsm3/contracts/navigation";

export type Featured = NonNullable<NavSection["featured"]>;

export function sectionFor(sections: readonly NavSection[], path: string): NavSection | undefined {
  return sections.find((section) => path === section.href || path.startsWith(`${section.href}/`));
}

const PUBLISHED_PAGE_LINKS = new Set([
  "/kandydaci/dzien-otwarty",
  "/uczniowie/wychowawcy",
  "/zamowienia-publiczne",
]);

export function isRoutablePagePath(path: string): boolean {
  return path !== "/szkola/projekty/erasmus";
}

export function isVisibleHref(href: string, publishedPaths: ReadonlySet<string>): boolean {
  const path = href.replace(/#.*$/u, "");
  return isRoutablePagePath(path) && (!PUBLISHED_PAGE_LINKS.has(path) || publishedPaths.has(path));
}

function isVisibleLink(link: NavLink, publishedPaths: ReadonlySet<string>): boolean {
  return isVisibleHref(link.href, publishedPaths);
}

export function visibleGroups(
  groups: readonly NavGroup[],
  publishedPaths: ReadonlySet<string>,
): NavGroup[] {
  return groups.map((group) => ({
    ...group,
    links: group.links.filter((link) => isVisibleLink(link, publishedPaths)),
  }));
}

export function visibleNavigation(
  navigation: Navigation,
  publishedPaths: ReadonlySet<string>,
): Navigation {
  return {
    ...navigation,
    sections: navigation.sections
      .filter((section) => isVisibleHref(section.href, publishedPaths))
      .map((section) => ({
        ...section,
        groups: visibleGroups(section.groups, publishedPaths),
      })),
    utilityLinks: navigation.utilityLinks.filter((link) => isVisibleLink(link, publishedPaths)),
    footerGroups: visibleGroups(navigation.footerGroups, publishedPaths),
  };
}
