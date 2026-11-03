import type { OpenOutcome } from "@zsm3/worker/short-links/resolve.ts";

import { bytesPhrase } from "./panel/uploads.ts";

export type ShortLinkState = Exclude<OpenOutcome, { kind: "redirect" }>;

export type ShortLinkForm = "password" | "download" | null;

export interface ShortLinkView {
  readonly status: number;
  readonly heading: string;
  readonly message: string;
  readonly form: ShortLinkForm;
}

export const PASSWORD_ERRORS: Readonly<Record<string, string>> = {
  haslo: "Nieprawidłowe hasło. Spróbuj ponownie.",
  limit: "Hasło wpisano błędnie zbyt wiele razy. Spróbuj ponownie za kilka minut.",
  doba: "Do tego linku wpisano w ciągu doby zbyt wiele błędnych haseł, więc na razie jest zablokowany. Spróbuj ponownie jutro albo poproś nauczyciela o nowy link.",
  brak: "Nie możemy teraz sprawdzić hasła. Spróbuj ponownie później.",
  plik: "Pliku nie da się teraz pobrać. Spróbuj ponownie później albo poproś nauczyciela o nowy link.",
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
        form: "password",
      };
    case "download":
      return {
        status: 200,
        heading: "Materiał do pobrania",
        message: `Plik ${state.file.name} (${state.file.format.toUpperCase()}, ${bytesPhrase(state.file.bytes)}) zapisze się na twoim urządzeniu.`,
        form: "download",
      };
    case "gone":
      return {
        status: 410,
        heading: "Link wygasł",
        message: "Ten link już nie działa. Poproś nauczyciela o nowy.",
        form: null,
      };
    case "missing":
      return {
        status: 404,
        heading: "Nie znaleziono linku",
        message: "Sprawdź, czy adres został przepisany poprawnie.",
        form: null,
      };
  }
}
