export interface Person {
  readonly name?: string;
  readonly role: string;
  readonly subjects?: string;
}

export interface StaffGroup {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly subjects: readonly string[];
  readonly people: readonly Person[];
}

export function personLine({ role, subjects }: Person): string {
  return subjects === undefined ? role : `${role}, ${subjects}`;
}

export function initials(name: string): string {
  return name
    .split(/[\s-]+/u)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("pl"))
    .join("");
}
