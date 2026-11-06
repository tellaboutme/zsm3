export const PRIVACY_REVIEW_LABEL =
  "Sprawdziłem/am pytanie i odpowiedź: nie ma w nich imion, nazwisk, oznaczeń klas, danych kontaktowych ani szczegółów, po których można rozpoznać ucznia lub inne osoby.";

export const PRIVACY_REVIEW_MISSING =
  "Aby opublikować, zaznacz potwierdzenie, że treść została sprawdzona pod kątem danych identyfikujących.";

export const PRIVACY_HINTS_NONE =
  "Automatyczna kontrola nic nie znalazła, ale nie zastąpi Twojej oceny. Przeczytaj treść jeszcze raz.";

interface HintRule {
  readonly pattern: RegExp;
  readonly hint: string;
}

const RULES: readonly HintRule[] = [
  {
    pattern: /\d/u,
    hint: "Tekst zawiera cyfry — sprawdź, czy to nie numer telefonu, oznaczenie klasy, numer sali ani data, po której można kogoś rozpoznać.",
  },
  {
    pattern: /@|https?:\/\/|www\./iu,
    hint: "Tekst zawiera adres e-mail albo link.",
  },
  {
    pattern: /[^.!?\s]\s+\p{Lu}\p{Ll}/u,
    hint: "Tekst zawiera wyrazy wielką literą w środku zdania — sprawdź, czy to nie imiona, nazwiska, pseudonimy ani nazwy miejsc.",
  },
  {
    pattern:
      /\b(?:wychowawc|nauczyciel|pani|pan|kolega|koleżank|brat|siostr|mam[aą]|tat[aą])\p{Ll}*/iu,
    hint: "Tekst wspomina konkretne osoby (np. nauczyciela, kolegę, rodzica) — sprawdź, czy razem z innymi szczegółami nie wskazuje, o kogo chodzi.",
  },
];

export function privacyHints(...texts: readonly string[]): readonly string[] {
  return RULES.filter((rule) => texts.some((text) => rule.pattern.test(text))).map(
    (rule) => rule.hint,
  );
}
