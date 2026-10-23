import { termMatch } from "./search-match.ts";
import { fold, queryTerms } from "./search-text.ts";

export interface Segment {
  readonly text: string;
  readonly marked: boolean;
}

interface Span {
  readonly start: number;
  readonly end: number;
}

interface WordSpan extends Span {
  readonly word: string;
}

const WORD = /[\p{L}\d]+/gu;
const ELLIPSIS: Segment = { text: "…", marked: false };

export const SNIPPET_LENGTH = 160;
export const SNIPPET_LEAD = 60;

function wordSpans(text: string): readonly WordSpan[] {
  return [...text.matchAll(WORD)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    word: fold(match[0]),
  }));
}

function markedSpan(span: WordSpan, next: WordSpan | undefined, terms: readonly string[]): Span[] {
  if (next !== undefined && terms.includes(span.word + next.word)) {
    return [{ start: span.start, end: next.end }];
  }
  return terms.some((term) => termMatch(term, [span.word]) > 0) ? [span] : [];
}

export function markedSpans(text: string, terms: readonly string[]): readonly Span[] {
  const spans = wordSpans(text);
  const marked = spans.flatMap((span, position) => markedSpan(span, spans[position + 1], terms));
  return marked
    .filter((span, position) => span.start >= (marked[position - 1]?.end ?? 0))
    .map(({ start, end }) => ({ start, end }));
}

export function windowFor(text: string, first: Span | undefined): Span {
  if (text.length <= SNIPPET_LENGTH) {
    return { start: 0, end: text.length };
  }
  const wanted = Math.max(0, (first?.start ?? 0) - SNIPPET_LEAD);
  const start = text.lastIndexOf(" ", wanted) + 1;
  const limit = start + SNIPPET_LENGTH;
  if (limit >= text.length) {
    return { start, end: text.length };
  }
  const cut = text.lastIndexOf(" ", limit);
  return { start, end: cut > start ? cut : limit };
}

export function snippet(text: string, query: string): readonly Segment[] {
  const spans = markedSpans(text, queryTerms(query));
  const view = windowFor(text, spans[0]);
  const shown = spans.filter((span) => span.end <= view.end);
  const segments = shown.flatMap((span, position): Segment[] => {
    const from = shown[position - 1]?.end ?? view.start;
    const plain = text.slice(from, span.start);
    const marked = { text: text.slice(span.start, span.end), marked: true };
    return plain.length > 0 ? [{ text: plain, marked: false }, marked] : [marked];
  });
  const tail = text.slice(shown.at(-1)?.end ?? view.start, view.end);
  return [
    ...(view.start > 0 ? [ELLIPSIS] : []),
    ...segments,
    ...(tail.length > 0 ? [{ text: tail, marked: false }] : []),
    ...(view.end < text.length ? [ELLIPSIS] : []),
  ];
}
