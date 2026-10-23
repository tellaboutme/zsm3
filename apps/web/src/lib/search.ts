import { editDistance, termMatch, typoAllowance } from "./search-match.ts";
import { fold, queryTerms, tokens } from "./search-text.ts";

export const resultTypes = [
  "strona",
  "kierunek",
  "klasa",
  "kontakt",
  "aktualnosc",
  "dokument",
  "termin",
] as const;

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

export interface PreparedEntry {
  readonly entry: SearchEntry;
  readonly title: readonly string[];
  readonly text: readonly string[];
  readonly phrase: string;
}

export interface SearchIndex {
  readonly entries: readonly PreparedEntry[];
  readonly vocabulary: readonly string[];
}

export interface QueryTerm {
  readonly term: string;
  readonly typos: boolean;
}

export const resultTypeLabels: Readonly<Record<ResultType, string>> = {
  strona: "Strony",
  kierunek: "Kierunki",
  klasa: "Klasy i sale",
  kontakt: "Kontakty",
  aktualnosc: "Aktualności",
  dokument: "Dokumenty",
  termin: "Terminy",
};

export const TITLE_WEIGHT = 3;
export const TEXT_WEIGHT = 1;
export const PHRASE_BONUS = 2;
export const SUGGEST_EXTRA_LENGTH = 7;

export function prepare(entries: readonly SearchEntry[]): SearchIndex {
  const prepared = entries.map((entry) => ({
    entry,
    title: tokens(entry.title),
    text: tokens(entry.text),
    phrase: fold(entry.title),
  }));
  const vocabulary = [...new Set(prepared.flatMap((item) => [...item.title, ...item.text]))];
  return { entries: prepared, vocabulary };
}

function termScore({ term, typos }: QueryTerm, prepared: PreparedEntry): number {
  return Math.max(
    TITLE_WEIGHT * termMatch(term, prepared.title, typos),
    TEXT_WEIGHT * termMatch(term, prepared.text, typos),
  );
}

export function score(prepared: PreparedEntry, terms: readonly QueryTerm[]): number {
  const points = terms.map((term) => termScore(term, prepared));
  if (points.some((point) => point === 0)) {
    return 0;
  }
  const phrase = terms.map(({ term }) => term).join(" ");
  const bonus = terms.length > 1 && prepared.phrase.includes(phrase) ? PHRASE_BONUS : 0;
  return points.reduce((sum, point) => sum + point, bonus);
}

export function analyse(index: SearchIndex, query: string): readonly QueryTerm[] {
  return queryTerms(query).map((term) => ({
    term,
    typos: !index.vocabulary.some((word) => word.startsWith(term)),
  }));
}

export function search(index: SearchIndex, query: string): readonly SearchEntry[] {
  const terms = analyse(index, query);
  return index.entries
    .map((prepared) => ({ entry: prepared.entry, points: score(prepared, terms) }))
    .filter(({ points }) => points > 0)
    .toSorted((first, second) => {
      const difference = second.points - first.points;
      return difference === 0
        ? first.entry.title.localeCompare(second.entry.title, "pl")
        : difference;
    })
    .map(({ entry }) => entry);
}

function closestWord(term: string, vocabulary: readonly string[]): string {
  const extra = typoAllowance(term) > 0 && term.length >= SUGGEST_EXTRA_LENGTH ? 1 : 0;
  const allowance = typoAllowance(term) + extra;
  const ranked = vocabulary
    .map((word) => ({ word, distance: editDistance(term, word) }))
    .filter(({ distance }) => distance <= allowance)
    .toSorted((first, second) => first.distance - second.distance);
  return ranked[0]?.word ?? term;
}

export function suggestion(index: SearchIndex, query: string): string | undefined {
  const terms = queryTerms(query);
  const corrected = terms.map((term) => closestWord(term, index.vocabulary));
  const changed = corrected.some((word, position) => word !== terms[position]);
  const proposal = corrected.join(" ");
  return changed && search(index, proposal).length > 0 ? proposal : undefined;
}

export function groupResults(results: readonly SearchEntry[]): readonly ResultGroup[] {
  const order = [...new Set(results.map((entry) => entry.type))];
  return order.map((type) => ({
    type,
    label: resultTypeLabels[type],
    entries: results.filter((entry) => entry.type === type),
  }));
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
