import { stem } from "./search-text.ts";
import { synonymGroups } from "../data/search-synonyms.ts";

export const MATCH_EXACT = 1;
export const MATCH_STEM = 0.9;
export const MATCH_PREFIX = 0.8;
export const MATCH_SYNONYM = 0.7;
export const MATCH_TYPO = 0.5;
export const PREFIX_TYPOS = 1;
export const PREFIX_TYPO_LENGTH = 5;
export const MIN_SHARED_ROOT = 5;
export const ROOT_SLACK = 2;

export function synonymsOf(term: string): readonly string[] {
  const root = stem(term);
  const groups = synonymGroups.filter((group) => group.some((word) => stem(word) === root));
  return [...new Set(groups.flat())].filter((word) => stem(word) !== root);
}

export function typoAllowance(term: string): number {
  if (/\d/u.test(term)) {
    return 0;
  }
  if (term.length >= 8) {
    return 2;
  }
  return term.length >= 4 ? 1 : 0;
}

function at(row: readonly number[], index: number): number {
  return row[index] ?? Number.POSITIVE_INFINITY;
}

function nextRow(
  first: string,
  second: string,
  row: number,
  rows: { readonly before: readonly number[]; readonly previous: readonly number[] },
): readonly number[] {
  const current = [row];
  for (let column = 1; column <= second.length; column += 1) {
    const cost = first[row - 1] === second[column - 1] ? 0 : 1;
    const best = Math.min(
      at(rows.previous, column) + 1,
      at(current, column - 1) + 1,
      at(rows.previous, column - 1) + cost,
    );
    const swapped = first[row - 1] === second[column - 2] && first[row - 2] === second[column - 1];
    const transposition = at(rows.before, column - 2) + 1;
    current.push(swapped ? Math.min(best, transposition) : best);
  }
  return current;
}

export function editDistance(first: string, second: string): number {
  let before: readonly number[] = [];
  let previous: readonly number[] = [...Array.from({ length: second.length + 1 }).keys()];
  for (let row = 1; row <= first.length; row += 1) {
    const current = nextRow(first, second, row, { before, previous });
    before = previous;
    previous = current;
  }
  return at(previous, second.length);
}

function isNear(term: string, word: string): boolean {
  const start = word.slice(0, term.length);
  return (
    editDistance(term, word) <= typoAllowance(term) ||
    (term.length >= PREFIX_TYPO_LENGTH && editDistance(term, start) <= PREFIX_TYPOS)
  );
}

export function sharesRoot(first: string, second: string): boolean {
  const left = stem(first);
  const right = stem(second);
  const needed = Math.max(MIN_SHARED_ROOT, Math.min(first.length, second.length) - ROOT_SLACK);
  const extended = left.startsWith(right) || right.startsWith(left);
  return left === right || (Math.min(left.length, right.length) >= needed && extended);
}

export function directMatch(term: string, word: string): number {
  if (word === term) {
    return MATCH_EXACT;
  }
  if (word.startsWith(term)) {
    return MATCH_PREFIX;
  }
  return sharesRoot(term, word) ? MATCH_STEM : 0;
}

export function matchWord(term: string, word: string, typos = true): number {
  const direct = directMatch(term, word);
  if (direct > 0 || !typos) {
    return direct;
  }
  return isNear(term, word) ? MATCH_TYPO : 0;
}

export function bestMatch(term: string, candidates: readonly string[], typos = true): number {
  return candidates.reduce((best, word) => Math.max(best, matchWord(term, word, typos)), 0);
}

export function termMatch(term: string, candidates: readonly string[], typos = true): number {
  const viaSynonyms = synonymsOf(term).map((word) =>
    Math.min(bestMatch(word, candidates, false), MATCH_SYNONYM),
  );
  return Math.max(bestMatch(term, candidates, typos), ...viaSynonyms);
}
