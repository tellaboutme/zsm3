export const resultTypes = ["strona", "kierunek", "aktualnosc", "dokument", "termin"] as const;

export type ResultType = (typeof resultTypes)[number];

export interface SearchEntry {
  readonly type: ResultType;
  readonly title: string;
  readonly href: string;
  readonly text: string;
}

export interface ResultGroup {
  readonly type: ResultType;
  readonly label: string;
  readonly entries: readonly SearchEntry[];
}

export const resultTypeLabels: Readonly<Record<ResultType, string>> = {
  strona: "Strony",
  kierunek: "Kierunki",
  aktualnosc: "Aktualności",
  dokument: "Dokumenty",
  termin: "Terminy",
};

const MIN_QUERY_LENGTH = 2;
const STEM_CUTS: readonly (readonly [number, number])[] = [
  [9, 3],
  [7, 2],
  [5, 1],
];

export function fold(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ł", "l")
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

export function stem(term: string): string {
  const cut = STEM_CUTS.find(([minimum]) => term.length >= minimum)?.[1] ?? 0;
  return term.slice(0, term.length - cut);
}

export function queryTerms(query: string): readonly string[] {
  const folded = fold(query);
  return folded.length < MIN_QUERY_LENGTH ? [] : folded.split(" ").map(stem);
}

function score(entry: SearchEntry, terms: readonly string[]): number {
  const title = fold(entry.title);
  const body = fold(entry.text);
  return terms.reduce((total, term) => {
    if (title.includes(term)) {
      return total + 1;
    }
    return body.includes(term) ? total : Number.NEGATIVE_INFINITY;
  }, 0);
}

export function search(entries: readonly SearchEntry[], query: string): readonly SearchEntry[] {
  const terms = queryTerms(query);
  return entries
    .map((entry) => ({ entry, points: score(entry, terms) }))
    .filter(({ points }) => terms.length > 0 && Number.isFinite(points))
    .toSorted((first, second) => {
      const difference = second.points - first.points;
      return difference === 0
        ? first.entry.title.localeCompare(second.entry.title, "pl")
        : difference;
    })
    .map(({ entry }) => entry);
}

export function groupResults(results: readonly SearchEntry[]): readonly ResultGroup[] {
  return resultTypes
    .map((type) => ({
      type,
      label: resultTypeLabels[type],
      entries: results.filter((entry) => entry.type === type),
    }))
    .filter((group) => group.entries.length > 0);
}

function isSearchEntry(entry: unknown): entry is SearchEntry {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }
  const type: unknown = Reflect.get(entry, "type");
  const title: unknown = Reflect.get(entry, "title");
  const href: unknown = Reflect.get(entry, "href");
  const text: unknown = Reflect.get(entry, "text");
  return (
    resultTypes.some((candidate) => candidate === type) &&
    typeof title === "string" &&
    typeof href === "string" &&
    href.startsWith("/") &&
    typeof text === "string"
  );
}

export function isSearchIndex(value: unknown): value is readonly SearchEntry[] {
  return Array.isArray(value) && value.every(isSearchEntry);
}
