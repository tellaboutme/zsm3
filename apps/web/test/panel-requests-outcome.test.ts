import { describe, expect, it } from "vitest";

import { CONNECTION_STATUS } from "../src/lib/panel/api.ts";
import {
  STALE_DETAIL_PHRASE,
  readPhrase,
  shouldReload,
  transitionPhrase,
} from "../src/lib/panel/requests.ts";

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
    expect(readPhrase(CONNECTION_STATUS)).toBe("Brak połączenia z serwerem. Spróbuj ponownie.");
    expect(readPhrase(404)).toBe("Nie znaleziono elementu. Odśwież listę.");
    for (const status of [200, 404, 409, 422]) {
      expect(shouldReload(status)).toBe(true);
    }
    for (const status of [CONNECTION_STATUS, 401, 403, 500]) {
      expect(shouldReload(status)).toBe(false);
    }
  });
});
