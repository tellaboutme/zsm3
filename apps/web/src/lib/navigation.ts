import type { NavSection } from "@zsm3/contracts/navigation";

export type { NavGroup, NavLink, NavSection } from "@zsm3/contracts/navigation";

export type Featured = NonNullable<NavSection["featured"]>;

export function sectionFor(sections: readonly NavSection[], path: string): NavSection | undefined {
  return sections.find((section) => path === section.href || path.startsWith(`${section.href}/`));
}
