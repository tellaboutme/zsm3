const STEM_CUTS: readonly (readonly [number, number])[] = [
  [9, 3],
  [7, 2],
  [5, 1],
];

const QUALIFICATION_CODE = /(?<![\p{L}\d])([a-z]{2,4})\.? ?(\d{2})(?!\d)/gu;
const CLASS_CODE = /(?<![\p{L}\d])([1-5]) ?([tbl][a-z]{0,2})((?:\/[a-z])+)?(?![\p{L}\d])/gu;

export const MIN_TERM_LENGTH = 2;

export function foldMarks(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ł", "l")
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "");
}

export function fold(text: string): string {
  return foldMarks(text)
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

export function stem(term: string): string {
  const cut = STEM_CUTS.find(([minimum]) => term.length >= minimum)?.[1] ?? 0;
  return term.slice(0, term.length - cut);
}

function group(match: RegExpMatchArray, index: number): string {
  return match[index] ?? "";
}

export function classCodes(text: string): readonly string[] {
  return [...foldMarks(text).matchAll(CLASS_CODE)].flatMap((match) => {
    const grade = group(match, 1);
    const letters = group(match, 2);
    const alternatives = group(match, 3)
      .split("/")
      .filter((part) => part.length > 0);
    return [
      `${grade}${letters}`,
      ...alternatives.map((part) => `${grade}${letters.slice(0, -1)}${part}`),
    ];
  });
}

export function qualificationCodes(text: string): readonly string[] {
  return [...foldMarks(text).matchAll(QUALIFICATION_CODE)].map(
    (match) => `${group(match, 1)}${group(match, 2)}`,
  );
}

export function words(text: string): readonly string[] {
  const folded = fold(text);
  return folded.length === 0 ? [] : folded.split(" ");
}

export function tokens(text: string): readonly string[] {
  return [...new Set([...words(text), ...classCodes(text), ...qualificationCodes(text)])];
}

export function queryTerms(query: string): readonly string[] {
  const joined = foldMarks(query)
    .replace(CLASS_CODE, (code) => ` ${String(classCodes(code).slice(0, 1))} `)
    .replace(QUALIFICATION_CODE, (code) => ` ${String(qualificationCodes(code))} `);
  return [...new Set(words(joined).filter((term) => term.length >= MIN_TERM_LENGTH))];
}
