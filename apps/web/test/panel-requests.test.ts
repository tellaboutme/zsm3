import type { PanelRequestDetail } from "@zsm3/contracts/requests";
import { describe, expect, it } from "vitest";

import { CONNECTION_STATUS } from "../src/lib/panel/api.ts";
import {
  REQUEST_STATUS_LABELS,
  canHandleRequests,
  listPhrase,
  nextCursor,
  piiNotice,
  piiState,
  readPhrase,
  requestFacts,
  requestHead,
  requestTitle,
  requestsPath,
  shouldReload,
  staffActions,
  statusFilter,
  transitionPhrase,
} from "../src/lib/panel/requests.ts";

const ID = "0192f3a1-7c00-7000-8000-000000000001";
const OTHER = "0192f3a1-7c00-7000-8000-000000000002";
const AT = "2026-10-22T08:30:00.000Z";

function detail(overrides: Partial<PanelRequestDetail> = {}): PanelRequestDetail {
  return {
    id: ID,
    type: "ENROLLMENT_CERTIFICATE",
    status: "submitted",
    createdAt: AT,
    updatedAt: "2026-10-23T09:00:00.000Z",
    firstName: "Anna",
    lastName: "Nowak",
    className: null,
    graduationYear: null,
    email: "anna@example.com",
    note: null,
    piiErasedAt: null,
    ...overrides,
  };
}

describe("requests list", () => {
  it("builds list paths with the status filter and the composite cursor", () => {
    expect(requestsPath("all", null)).toBe("/api/panel/requests");
    expect(requestsPath("ready", null)).toBe("/api/panel/requests?status=ready");
    expect(requestsPath("all", { before: AT, beforeId: OTHER })).toBe(
      `/api/panel/requests?before=${encodeURIComponent(AT)}&beforeId=${OTHER}`,
    );
    expect(requestsPath("in_progress", { before: AT, beforeId: null })).toBe(
      `/api/panel/requests?status=in_progress&before=${encodeURIComponent(AT)}`,
    );
  });

  it("keeps the id half of the cursor so equal timestamps do not skip rows", () => {
    expect(nextCursor({ items: [], nextBefore: AT, nextBeforeId: OTHER })).toEqual({
      before: AT,
      beforeId: OTHER,
    });
    expect(nextCursor({ items: [], nextBefore: AT, nextBeforeId: null })).toEqual({
      before: AT,
      beforeId: null,
    });
    expect(nextCursor({ items: [], nextBefore: null, nextBeforeId: OTHER })).toBeNull();
  });

  it("accepts only known statuses as a filter", () => {
    expect(statusFilter("ready")).toBe("ready");
    expect(statusFilter("all")).toBe("all");
    expect(statusFilter("anything")).toBe("all");
  });

  it("describes empty and filled lists", () => {
    expect(listPhrase(0, "all")).toBe("Nie ma jeszcze żadnych wniosków.");
    expect(listPhrase(0, "ready")).toBe("Brak wniosków o statusie „Gotowy do odbioru”.");
    expect(listPhrase(3, "ready")).toBe("Wniosków na liście: 3.");
  });

  it("titles and heads a row without personal data", () => {
    const row = detail();
    expect(requestTitle(row)).toBe("Zaświadczenie o uczęszczaniu do szkoły");
    expect(requestHead(row)).toBe(`22 paź 2026, 10:30 · nr ${ID}`);
    expect(requestHead(row)).not.toContain("Nowak");
  });
});

describe("request actions", () => {
  it("offers only the staff transitions of the lifecycle", () => {
    expect(staffActions("submitted").map((action) => action.to)).toEqual([
      "in_progress",
      "rejected",
    ]);
    expect(staffActions("in_progress").map((action) => action.to)).toEqual(["ready", "rejected"]);
    expect(staffActions("ready").map((action) => action.to)).toEqual(["collected", "rejected"]);
    for (const closed of ["collected", "rejected", "withdrawn"] as const) {
      expect(staffActions(closed)).toEqual([]);
    }
  });

  it("asks for confirmation before every change that mails or closes", () => {
    const [start, reject] = staffActions("submitted");
    expect(start).toEqual({ to: "in_progress", label: "Przyjmij do realizacji", warning: null });
    expect(reject?.label).toBe("Odrzuć wniosek");
    expect(reject?.warning).toContain("e-mail o odrzuceniu");
    const [ready] = staffActions("in_progress");
    expect(ready?.label).toBe("Oznacz jako gotowy do odbioru");
    expect(ready?.warning).toContain("e-mail");
    const [collected] = staffActions("ready");
    expect(collected?.label).toBe("Potwierdź odbiór");
    expect(collected?.warning).toContain("nie można cofnąć");
  });

  it("lets only admin and secretariat handle requests", () => {
    expect(canHandleRequests("admin")).toBe(true);
    expect(canHandleRequests("secretariat")).toBe(true);
    expect(canHandleRequests("editor")).toBe(false);
    expect(canHandleRequests("gallery_editor")).toBe(false);
    expect(canHandleRequests("")).toBe(false);
  });
});

describe("request detail", () => {
  it("shows personal data only while it is readable", () => {
    const facts = requestFacts(detail({ className: "3TI", graduationYear: 2024, note: "Pilne" }));
    expect(facts).toEqual([
      { label: "Rodzaj", value: "Zaświadczenie o uczęszczaniu do szkoły" },
      { label: "Status", value: "Złożony" },
      { label: "Złożony", value: "22 paź 2026, 10:30" },
      { label: "Ostatnia zmiana", value: "23 paź 2026, 11:00" },
      { label: "Imię i nazwisko", value: "Anna Nowak" },
      { label: "E-mail", value: "anna@example.com" },
      { label: "Klasa", value: "3TI" },
      { label: "Rok ukończenia szkoły", value: "2024" },
      { label: "Uwagi wnioskodawcy", value: "Pilne" },
    ]);
    expect(requestFacts(detail()).map((fact) => fact.label)).toEqual([
      "Rodzaj",
      "Status",
      "Złożony",
      "Ostatnia zmiana",
      "Imię i nazwisko",
      "E-mail",
    ]);
    expect(piiState(detail())).toBe("present");
    expect(piiNotice(detail())).toBeNull();
  });

  it("explains erased personal data", () => {
    const erased = detail({
      status: "withdrawn",
      firstName: null,
      lastName: null,
      email: null,
      piiErasedAt: "2026-10-24T12:00:00.000Z",
    });
    expect(piiState(erased)).toBe("erased");
    expect(piiNotice(erased)).toBe(
      "Dane osobowe usunięto 24 paź 2026, 14:00 (wycofanie wniosku albo koniec okresu przechowywania).",
    );
    expect(requestFacts(erased)).toHaveLength(4);
    expect(requestFacts(detail({ piiErasedAt: "2026-10-24T12:00:00.000Z" }))).toHaveLength(4);
  });

  it("flags personal data that cannot be read", () => {
    const unreadable = detail({ firstName: null, lastName: null, email: null });
    expect(piiState(unreadable)).toBe("unreadable");
    expect(piiState(detail({ email: null }))).toBe("unreadable");
    expect(piiState(detail({ firstName: null }))).toBe("unreadable");
    expect(piiNotice(unreadable)).toContain("Nie udało się odczytać danych osobowych");
    expect(requestFacts(unreadable)).toHaveLength(4);
    expect(requestFacts(detail({ lastName: null }))[4]).toEqual({
      label: "Imię i nazwisko",
      value: "Anna",
    });
  });

  it("labels every status", () => {
    expect(REQUEST_STATUS_LABELS).toEqual({
      submitted: "Złożony",
      in_progress: "W realizacji",
      ready: "Gotowy do odbioru",
      collected: "Odebrany",
      rejected: "Odrzucony",
      withdrawn: "Wycofany przez wnioskodawcę",
    });
  });
});

describe("transition outcome", () => {
  it("phrases every answer and reloads when the stored state may differ", () => {
    expect(transitionPhrase(200, "ready")).toBe("Zapisano. Nowy status: Gotowy do odbioru.");
    expect(transitionPhrase(409, "ready")).toContain("Ktoś inny zmienił ten wniosek");
    expect(transitionPhrase(422, "rejected")).toContain("Tej zmiany nie można wykonać");
    expect(transitionPhrase(CONNECTION_STATUS, "collected")).toBe(
      "Brak połączenia z serwerem. Spróbuj ponownie. Status wniosku mógł się nie zmienić.",
    );
    expect(transitionPhrase(403, "collected")).toBe("Brak uprawnień do tej czynności.");
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
