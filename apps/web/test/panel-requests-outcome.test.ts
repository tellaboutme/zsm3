import { describe, expect, it } from "vitest";

import { CONNECTION_STATUS, problemPhrase } from "../src/lib/panel/api.ts";
import { STALE_DETAIL_PHRASE, transitionPhrase } from "../src/lib/panel/requests.ts";

describe("transition outcome", () => {
  it("phrases every answer and reloads when the stored state may differ", () => {
    expect(transitionPhrase(200, "ready")).toBe("Zapisano. Nowy status: Gotowy do odbioru.");
    expect(transitionPhrase(409, "ready")).toContain("Ktoś inny zmienił ten wniosek");
    expect(transitionPhrase(422, "rejected")).toContain("Tej zmiany nie można wykonać");
    expect(transitionPhrase(CONNECTION_STATUS, "collected")).toBe(
      "Brak połączenia z serwerem. Spróbuj ponownie. Status wniosku mógł się nie zmienić.",
    );
    expect(transitionPhrase(403, "collected")).toBe("Brak uprawnień do tej czynności.");
    expect(STALE_DETAIL_PHRASE).toBe(
      "Nie udało się wczytać aktualnego stanu wniosku. Otwórz go ponownie z listy.",
    );
    expect(problemPhrase(CONNECTION_STATUS)).toBe("Brak połączenia z serwerem. Spróbuj ponownie.");
    expect(problemPhrase(404)).toBe("Nie znaleziono elementu. Odśwież listę.");
  });
});
