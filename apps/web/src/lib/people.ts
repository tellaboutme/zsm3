import type { StaffDirectory } from "@zsm3/contracts/datasets";

export type StaffGroup = StaffDirectory[number];

export type Person = StaffGroup["people"][number];

export function personLine({ role, subjects }: Person): string {
  return subjects === undefined ? role : `${role}, ${subjects}`;
}

export function initials(name: string): string {
  return name
    .split(/[\s-]/u)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("pl"))
    .join("");
}
