import { describe, it } from "vitest";

import { passwordError, shortLinkView } from "../src/lib/short-link-page.ts";

describe("the short link page", () => {
  it("shows the password form for a link that asks for a password", ({ expect }) => {
    expect(shortLinkView({ kind: "locked" })).toEqual({
      status: 200,
      heading: "Link zabezpieczony hasłem",
      message: "Ten materiał udostępniono z hasłem. Podaj hasło otrzymane od nauczyciela.",
      form: "password",
    });
  });

  it("offers an open file for download with its name, format and size", ({ expect }) => {
    expect(
      shortLinkView({
        kind: "download",
        file: { name: "Karta pracy.pdf", format: "pdf", bytes: 2_621_440 },
      }),
    ).toEqual({
      status: 200,
      heading: "Materiał do pobrania",
      message: "Plik Karta pracy.pdf (PDF, 2.5 MB) zapisze się na twoim urządzeniu.",
      form: "download",
    });
  });

  it("names the mistake the worker reported in the address", ({ expect }) => {
    expect(passwordError("haslo")).toBe("Nieprawidłowe hasło. Spróbuj ponownie.");
    expect(passwordError("limit")).toBe(
      "Hasło wpisano błędnie zbyt wiele razy. Spróbuj ponownie za kilka minut.",
    );
    expect(passwordError("brak")).toBe(
      "Nie możemy teraz sprawdzić hasła. Spróbuj ponownie później.",
    );
    expect(passwordError("plik")).toBe(
      "Pliku nie da się teraz pobrać. Spróbuj ponownie później albo poproś nauczyciela o nowy link.",
    );
    expect(passwordError("cokolwiek")).toBeUndefined();
    expect(passwordError(null)).toBeUndefined();
  });

  it("answers an unknown code with 404 and a lapsed one with 410, without a form", ({ expect }) => {
    expect(shortLinkView({ kind: "missing" })).toEqual({
      status: 404,
      heading: "Nie znaleziono linku",
      message: "Sprawdź, czy adres został przepisany poprawnie.",
      form: null,
    });
    expect(shortLinkView({ kind: "gone" })).toEqual({
      status: 410,
      heading: "Link wygasł",
      message: "Ten link już nie działa. Poproś nauczyciela o nowy.",
      form: null,
    });
  });
});
