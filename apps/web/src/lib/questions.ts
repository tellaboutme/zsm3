import {
  QUESTION_ADDRESSEE_LABELS,
  QUESTION_MAX_LENGTH,
  questionAddressees,
  type QuestionAddressee,
} from "@zsm3/contracts/questions";

export const QUESTIONS_PATH = "/skrzynka";
export const QUESTIONS_PAGE_SIZE = 10;

export interface BoxAvailability {
  readonly open: boolean;
  readonly siteKey: string;
}

export function boxAvailability(
  enabled: string | undefined,
  siteKey: string | undefined,
): BoxAvailability {
  const key = siteKey?.trim() ?? "";
  return { open: enabled?.trim() === "true" && key.length > 0, siteKey: key };
}

export interface HelpLine {
  readonly name: string;
  readonly number: string;
  readonly href: string;
  readonly when: string;
}

export const HELP_LINES: readonly HelpLine[] = [
  {
    name: "Telefon zaufania dla dzieci i młodzieży",
    number: "116 111",
    href: "tel:116111",
    when: "bezpłatnie, przez całą dobę",
  },
  {
    name: "Numer alarmowy",
    number: "112",
    href: "tel:112",
    when: "gdy zagrożone jest czyjeś życie lub zdrowie",
  },
];

export function addresseeLabel(addressee: QuestionAddressee): string {
  return QUESTION_ADDRESSEE_LABELS[addressee];
}

export interface AddresseeOption {
  readonly value: QuestionAddressee;
  readonly label: string;
}

export const ADDRESSEE_OPTIONS: readonly AddresseeOption[] = questionAddressees.map((value) => ({
  value,
  label: QUESTION_ADDRESSEE_LABELS[value],
}));

export function paragraphs(text: string): readonly (readonly string[])[] {
  return text
    .split(/\n\s*\n/u)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    )
    .filter((lines) => lines.length > 0);
}

export function excerpt(text: string, limit = 160): string {
  const flat = text.replace(/\s+/gu, " ").trim();
  return flat.length <= limit ? flat : `${flat.slice(0, limit - 1).trimEnd()}…`;
}

export function questionsPageHref(page: number): string {
  return page <= 1 ? QUESTIONS_PATH : `${QUESTIONS_PATH}/strona/${String(page)}`;
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / QUESTIONS_PAGE_SIZE));
}

export function pageNumber(param: string | undefined): number | undefined {
  if (param === undefined || !/^[1-9]\d{0,3}$/u.test(param)) {
    return undefined;
  }
  const page = Number(param);
  return page === 1 ? undefined : page;
}

export function lengthHint(length: number): string {
  return `${String(length)} z ${String(QUESTION_MAX_LENGTH)} znaków`;
}

const REFUSALS: Readonly<Record<number, string>> = {
  400: "Nie udało się przyjąć pytania. Sprawdź jego treść i spróbuj ponownie.",
  403: "Weryfikacja nie powiodła się. Odśwież stronę i spróbuj ponownie.",
  404: "Skrzynka jest teraz zamknięta. Spróbuj później.",
  413: "Pytanie jest za długie. Skróć je i spróbuj ponownie.",
  415: "Nie udało się przyjąć pytania. Odśwież stronę i spróbuj ponownie.",
  429: "Wysłano zbyt wiele pytań w krótkim czasie. Spróbuj ponownie za kilkanaście minut.",
  503: "Skrzynka jest teraz zamknięta. Spróbuj później.",
};

export function questionRefusal(status: number): string {
  return (
    REFUSALS[status] ??
    "Nie udało się wysłać pytania. Sprawdź połączenie z internetem i spróbuj ponownie."
  );
}

export const QUESTION_FIELD_ERRORS: Readonly<Record<string, string>> = {
  addressee: "Wybierz, do kogo kierujesz pytanie.",
  question: `Napisz pytanie – od 10 do ${String(QUESTION_MAX_LENGTH)} znaków, bez znaków sterujących.`,
  rulesAccepted: "Potwierdź, że znasz zasady Skrzynki.",
  turnstileToken: "Zaczekaj na zakończenie weryfikacji i spróbuj ponownie.",
};

export function fieldError(field: string | undefined): string {
  return (field === undefined ? undefined : QUESTION_FIELD_ERRORS[field]) ?? "Sprawdź pytanie.";
}
