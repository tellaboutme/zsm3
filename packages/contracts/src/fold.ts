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
