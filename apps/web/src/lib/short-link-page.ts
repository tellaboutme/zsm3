import type { OpenOutcome } from "@zsm3/worker/short-links/resolve.ts";

export type ShortLinkState = Exclude<OpenOutcome, { kind: "redirect" }>;

export interface ShortLinkView {
  readonly status: number;
  readonly heading: string;
  readonly message: string;
  readonly showForm: boolean;
}

export const PASSWORD_ERRORS: Readonly<Record<string, string>> = {
  haslo: "Nieprawidłowe hasło. Spróbuj ponownie.",
  limit: "Hasło wpisano błędnie zbyt wiele razy. Spróbuj ponownie za kilka minut.",
  brak: "Nie możemy teraz sprawdzić hasła. Spróbuj ponownie później.",
};

export function passwordError(value: string | null): string | undefined {
  return value === null ? undefined : PASSWORD_ERRORS[value];
}

export function shortLinkView(state: ShortLinkState): ShortLinkView {
  switch (state.kind) {
    case "locked":
      return {
        status: 200,
        heading: "Link zabezpieczony hasłem",
        message: "Ten materiał udostępniono z hasłem. Podaj hasło otrzymane od nauczyciela.",
        showForm: true,
      };
    case "gone":
      return {
        status: 410,
        heading: "Link wygasł",
        message: "Ten link już nie działa. Poproś nauczyciela o nowy.",
        showForm: false,
      };
    case "missing":
      return {
        status: 404,
        heading: "Nie znaleziono linku",
        message: "Sprawdź, czy adres został przepisany poprawnie.",
        showForm: false,
      };
  }
}
