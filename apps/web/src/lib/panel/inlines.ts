import type { Inline } from "@zsm3/contracts/rich-text";

const ESCAPE = "\\";
const BOLD_MARKS = "**";
const ITALIC_MARKS = "__";
const BOTH_MARKS = "***";
const LINK_OPEN = "[";
const LABEL_FIND = "](";
const HREF_FIND = ")";

const RUN_BREAKS = new Set<string>(["*", "_", "[", "\n"]);
const LABEL_BREAKS = new Set<string>(["]", "\n"]);
const HREF_BREAKS = new Set<string>([")"]);

type Marks = readonly ("bold" | "italic")[];

const OPENERS: readonly { readonly token: string; readonly marks: Marks }[] = [
  { token: BOTH_MARKS, marks: ["bold", "italic"] },
  { token: BOLD_MARKS, marks: ["bold"] },
  { token: ITALIC_MARKS, marks: ["italic"] },
];

export type Scan<Value> = { readonly ok: true; readonly value: Value } | { readonly ok: false };

interface Pair {
  readonly text: string;
  readonly next: number;
}

interface Step {
  readonly text: string;
  readonly inline: Inline | undefined;
  readonly next: number;
}

function escapeInto(text: string, breaks: ReadonlySet<string>): string {
  let out = "";
  for (const character of text) {
    if (character === ESCAPE) {
      out += "\\\\";
      continue;
    }
    if (character === "\n") {
      out += "\\n";
      continue;
    }
    if (breaks.has(character)) {
      out += `${ESCAPE}${character}`;
      continue;
    }
    out += character;
  }
  return out;
}

function encodeInline(inline: Inline): string {
  if (inline.type === "link") {
    const label = escapeInto(inline.text, LABEL_BREAKS);
    const href = escapeInto(inline.href, HREF_BREAKS);
    return `${LINK_OPEN}${label}${LABEL_FIND}${href}${HREF_FIND}`;
  }
  const run = escapeInto(inline.text, RUN_BREAKS);
  const marks = inline.marks ?? [];
  if (marks.includes("bold") && marks.includes("italic")) {
    return `${BOTH_MARKS}${run}${BOTH_MARKS}`;
  }
  if (marks.includes("bold")) {
    return `${BOLD_MARKS}${run}${BOLD_MARKS}`;
  }
  if (marks.includes("italic")) {
    return `${ITALIC_MARKS}${run}${ITALIC_MARKS}`;
  }
  return run;
}

export function encodeInlines(inlines: readonly Inline[]): string {
  return inlines.map(encodeInline).join("");
}

function pairOf(source: string, index: number): Pair | undefined {
  if (source.charAt(index) !== ESCAPE || index + 1 >= source.length) {
    return undefined;
  }
  const following = source.charAt(index + 1);
  if (following === ESCAPE) {
    return { text: ESCAPE, next: index + 2 };
  }
  if (following === "n") {
    return { text: "\n", next: index + 2 };
  }
  return { text: following, next: index + 2 };
}

function unescapeMarkup(source: string): string {
  let text = "";
  let index = 0;
  while (index < source.length) {
    const pair = pairOf(source, index);
    if (pair === undefined) {
      text += source.charAt(index);
      index += 1;
      continue;
    }
    text += pair.text;
    index = pair.next;
  }
  return text;
}

function findEscaped(source: string, from: number, needle: string): Scan<number> {
  let index = from;
  while (index < source.length) {
    const pair = pairOf(source, index);
    if (pair !== undefined) {
      index = pair.next;
      continue;
    }
    if (source.startsWith(needle, index)) {
      return { ok: true, value: index };
    }
    index += 1;
  }
  return { ok: false };
}

function linkOf(source: string, index: number): Scan<Step> | undefined {
  if (source.charAt(index) !== LINK_OPEN) {
    return undefined;
  }
  const label = findEscaped(source, index + 1, LABEL_FIND);
  if (!label.ok) {
    return label;
  }
  const href = findEscaped(source, label.value + LABEL_FIND.length, HREF_FIND);
  if (!href.ok) {
    return href;
  }
  const text = unescapeMarkup(source.slice(index + LINK_OPEN.length, label.value));
  const target = unescapeMarkup(source.slice(label.value + LABEL_FIND.length, href.value));
  if (text.length === 0 || target.length === 0) {
    return { ok: false };
  }
  const inline: Inline = { type: "link", text, href: target };
  return { ok: true, value: { text: "", inline, next: href.value + HREF_FIND.length } };
}

function markOf(source: string, index: number): Scan<Step> | undefined {
  for (const opener of OPENERS) {
    if (!source.startsWith(opener.token, index)) {
      continue;
    }
    const start = index + opener.token.length;
    const end = findEscaped(source, start, opener.token);
    if (!end.ok) {
      return { ok: false };
    }
    const text = unescapeMarkup(source.slice(start, end.value));
    if (text.length === 0) {
      return { ok: false };
    }
    const inline: Inline = { type: "text", text, marks: [...opener.marks] };
    return { ok: true, value: { text: "", inline, next: end.value + opener.token.length } };
  }
  return undefined;
}

function plainOf(source: string, index: number): Step {
  const pair = pairOf(source, index);
  if (pair !== undefined) {
    return { text: pair.text, inline: undefined, next: pair.next };
  }
  return { text: source.charAt(index), inline: undefined, next: index + 1 };
}

function stepOf(source: string, index: number): Step | undefined {
  const link = linkOf(source, index);
  if (link !== undefined) {
    return link.ok ? link.value : undefined;
  }
  const marked = markOf(source, index);
  if (marked !== undefined) {
    return marked.ok ? marked.value : undefined;
  }
  return plainOf(source, index);
}

export function parseInlines(source: string): Inline[] | undefined {
  const inlines: Inline[] = [];
  let buffer = "";
  let index = 0;
  while (index < source.length) {
    const step = stepOf(source, index);
    if (step === undefined) {
      return undefined;
    }
    if (step.inline === undefined) {
      buffer += step.text;
      index = step.next;
      continue;
    }
    if (buffer.length > 0) {
      inlines.push({ type: "text", text: buffer });
      buffer = "";
    }
    inlines.push(step.inline);
    index = step.next;
  }
  if (buffer.length > 0) {
    inlines.push({ type: "text", text: buffer });
  }
  return inlines.length > 0 ? inlines : undefined;
}
