import { describe, it } from "vitest";

import { passwordError, shortLinkView } from "../src/lib/short-link-page.ts";

describe("the short link page", () => {
  it("shows the form for a link that asks for a password", ({ expect }) => {
    expect(shortLinkView({ kind: "locked" })).toEqual({
      status: 200,
      heading: "Link zabezpieczony hasłem",
      message: "Ten materiał udostępniono z hasłem. Podaj hasło otrzymane od nauczyciela.",
      showForm: true,
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
    expect(passwordError("cokolwiek")).toBeUndefined();
    expect(passwordError(null)).toBeUndefined();
  });

  it("answers an unknown code with 404 and a lapsed one with 410", ({ expect }) => {
    expect(shortLinkView({ kind: "missing" })).toMatchObject({
      status: 404,
      heading: "Nie znaleziono linku",
      showForm: false,
    });
    expect(shortLinkView({ kind: "gone" })).toMatchObject({
      status: 410,
      heading: "Link wygasł",
      showForm: false,
    });
  });

  it("never shows the form on a page that cannot take a password", ({ expect }) => {
    const closed = [shortLinkView({ kind: "missing" }), shortLinkView({ kind: "gone" })];

    expect(closed.map((view) => view.showForm)).toEqual([false, false]);
  });
});
