const MAX_LENGTH = 120;

const OTHER = /[^a-z0-9]+/u;

const STROKES = /[\u0300-\u036f]/gu;

function flattening(text: string): string {
  return text
    .normalize("NFD")
    .replace(STROKES, "")
    .toLowerCase()
    .replaceAll("ł", "l")
    .replaceAll("ø", "o");
}

function knockedOut(dashed: string): string {
  return dashed
    .split(OTHER)
    .filter((part) => part.length > 0)
    .join("-");
}

function cutOut(dashed: string): string {
  const cut = dashed.slice(0, MAX_LENGTH);
  if (cut.endsWith("-")) {
    return cut.slice(0, cut.length - 1);
  }
  return cut;
}

export function slugify(text: string): string {
  return cutOut(knockedOut(flattening(text)));
}
