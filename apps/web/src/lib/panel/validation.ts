export interface ValidationIssue {
  readonly code: string;
  readonly path: unknown;
}

const ISSUE_PHRASES: Readonly<Record<string, string>> = {
  expected_min: "wartość jest za krótka",
  expected_max: "wartość jest za długa",
  expected_int: "wartość ma być liczbą całkowitą",
  invalid_value: "wartość nie jest dozwolona",
  invalid_format: "wartość ma zły format",
  invalid_type: "wartość ma zły typ",
  unrecognized_keys: "pole nie przyjmuje tego wpisu",
  required: "podaj pole",
  too_small: "wartość jest za krótka",
  too_big: "wartość jest za długa",
};

const FIELD_LABELS: Readonly<Record<string, string>> = {
  slug: "Adres",
  date: "Data",
  category: "Kategoria",
  title: "Tytuł",
  lead: "Lead",
  body: "Treść",
  cover: "Zdjęcie w tytule",
  caption: "Podpis",
  credit: "Autor zdjęcia",
  path: "Ścieżka",
  kicker: "Nadtytuł",
  intro: "Wstęp",
  sections: "Sekcje",
  id: "Identyfikator",
  blocks: "Bloki",
  document: "Treść",
  events: "Wydarzenia",
  endDate: "Data końcowa",
  audience: "Odbiorcy",
  kind: "Typ",
  note: "Uwaga",
  items: "Pozycje",
  header: "Nagłówki",
  rows: "Wiersze",
  ordered: "Rodzaj listy",
  source: "Źródło",
  status: "Status",
};

function fieldLabel(segments: readonly unknown[]): string | undefined {
  for (const segment of segments) {
    if (typeof segment !== "number" && typeof segment !== "symbol") {
      const label = FIELD_LABELS[String(segment)];
      if (label !== undefined) {
        return label;
      }
    }
  }
  return undefined;
}

function issuePhrase(issue: ValidationIssue): string {
  const segments = issue.path instanceof Array ? issue.path : [];
  const label = fieldLabel(segments);
  const reason = ISSUE_PHRASES[issue.code] ?? "sprawdź wartość";
  return label === undefined ? reason : `${label}: ${reason}`;
}

export function validationPhrases(issues: readonly ValidationIssue[]): readonly string[] {
  return [...issues].slice(0, 5).map(issuePhrase);
}
