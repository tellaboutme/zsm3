import type { PanelQuestionDetail } from "@zsm3/contracts/questions";
import { describe, it } from "vitest";

import { panelMoment } from "../src/lib/panel/audit.ts";
import {
  QUESTION_STATUS_LABELS,
  UNSAVED_PHRASE,
  canEditDraft,
  canModerate,
  decisionActions,
  decisionPhrase,
  draftPhrase,
  draftSeed,
  historyLine,
  listPhrase,
  nextQuestionsCursor,
  originalNotice,
  questionFilter,
  questionHead,
  questionPath,
  questionsPath,
  readPhrase,
} from "../src/lib/panel/questions.ts";

const ID = "0191e4a0-0000-4000-8000-000000000000";

function detail(overrides: Partial<PanelQuestionDetail> = {}): PanelQuestionDetail {
  return {
    id: ID,
    addressee: "pedagogue",
    status: "received",
    version: 1,
    receivedOn: "2026-10-20",
    question: "Oryginał",
    unreadable: [],
    draft: null,
    published: null,
    history: [],
    ...overrides,
  };
}

describe("who moderates", () => {
  it("is the counsellor role only", ({ expect }) => {
    expect(["counsellor", "admin", "secretariat", "editor", ""].map(canModerate)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("queue addresses", () => {
  it("filters by status and continues from a cursor", ({ expect }) => {
    expect(questionFilter("draft")).toBe("draft");
    expect(questionFilter("nowe")).toBe("all");
    expect(questionsPath("all", null)).toBe("/api/panel/questions");
    expect(questionsPath("rejected", null)).toBe("/api/panel/questions?status=rejected");
    expect(questionsPath("all", { before: "2026-10-01", beforeId: ID })).toBe(
      `/api/panel/questions?before=2026-10-01&beforeId=${ID}`,
    );
    expect(questionPath("a b", "/draft")).toBe("/api/panel/questions/a%20b/draft");
    expect(questionPath(ID)).toBe(`/api/panel/questions/${ID}`);
  });

  it("takes the next cursor only when both halves are present", ({ expect }) => {
    const items = [] as const;
    expect(nextQuestionsCursor({ items: [...items], nextBefore: null, nextBeforeId: null })).toBe(
      null,
    );
    expect(nextQuestionsCursor({ items: [], nextBefore: "2026-10-01", nextBeforeId: null })).toBe(
      null,
    );
    expect(nextQuestionsCursor({ items: [], nextBefore: "2026-10-01", nextBeforeId: ID })).toEqual({
      before: "2026-10-01",
      beforeId: ID,
    });
  });
});

describe("decisions per status", () => {
  it("offers only the moves the API allows", ({ expect }) => {
    const statuses = ["received", "draft", "published", "rejected", "withdrawn"] as const;
    const offered = Object.fromEntries(
      statuses.map((status) => [
        status,
        decisionActions(detail({ status })).map((spec) => spec.action),
      ]),
    );
    expect(Object.keys(QUESTION_STATUS_LABELS)).toEqual([...statuses]);
    expect(offered).toEqual({
      received: ["reject", "delete"],
      draft: ["publish", "reject", "delete"],
      published: ["withdraw"],
      rejected: ["delete"],
      withdrawn: ["reject", "delete"],
    });
    expect(decisionActions(detail({ status: "draft" }))[0]).toMatchObject({
      label: "Opublikuj pytanie i odpowiedź",
      confirm: "Tak, opublikuj",
    });
    expect(decisionActions(detail({ status: "draft" }))[0]?.warning).toContain(
      "oznaczeń klas, danych kontaktowych",
    );
    expect(decisionActions(detail({ status: "published" }))[0]?.confirm).toBe("Tak, wycofaj");
    expect(decisionActions(detail({ status: "rejected" }))[0]?.warning).toContain(
      "nie można cofnąć",
    );
    expect(decisionActions(detail({ status: "received" }))[0]?.warning).toContain("po 30 dniach");
  });

  it("lets drafts be edited before publication and after withdrawal", ({ expect }) => {
    expect(
      (["received", "draft", "published", "rejected", "withdrawn"] as const).map((status) =>
        canEditDraft(detail({ status })),
      ),
    ).toEqual([true, true, false, false, true]);
  });
});

describe("detail text", () => {
  it("starts a publication draft blank instead of copying the original", ({ expect }) => {
    expect(draftSeed(detail())).toEqual({ question: "", answer: "" });
    expect(draftSeed(detail({ question: null }))).toEqual({ question: "", answer: "" });
    expect(draftSeed(detail({ draft: { question: "Szkic", answer: "Tak" } }))).toEqual({
      question: "Szkic",
      answer: "Tak",
    });
    expect(originalNotice(detail())).toBeNull();
    expect(originalNotice(detail({ question: null }))).toContain("usunięta przy publikacji");
  });

  it("describes the head and history in Polish", ({ expect }) => {
    expect(questionHead(detail())).toBe(
      "wskazany adresat: Pedagog szkolny · wpłynęło 20 października 2026",
    );
    const at = "2026-10-22T08:00:00Z";
    expect(historyLine({ at, action: "questions.publish", actorEmail: "p@zsm3.pl" })).toBe(
      `${panelMoment(at)} — opublikowano — p@zsm3.pl`,
    );
    expect(historyLine({ at, action: "questions.other", actorEmail: null })).toBe(
      `${panelMoment(at)} — questions.other — system`,
    );
    for (const [action, label] of [
      ["questions.draft", "zapisano szkic"],
      ["questions.reject", "odrzucono"],
      ["questions.withdraw", "wycofano publikację"],
      ["questions.delete", "usunięto"],
    ]) {
      expect(historyLine({ at, action: action ?? "", actorEmail: null })).toContain(label ?? "");
    }
  });
});

describe("feedback", () => {
  it("summarises the list", ({ expect }) => {
    expect(listPhrase(0, "all")).toBe("Nie ma żadnych pytań.");
    expect(listPhrase(0, "draft")).toBe("Brak pytań o statusie „Szkic odpowiedzi”.");
    expect(listPhrase(0, "all", true)).toContain("Pokaż starsze");
    expect(listPhrase(3, "all")).toBe("Pytań na liście: 3.");
  });

  it("explains draft and decision outcomes", ({ expect }) => {
    expect(draftPhrase(200)).toBe("Zapisano szkic. Nic nie zostało opublikowane.");
    expect(draftPhrase(422)).toContain("od 10 do 1500 znaków, odpowiedź do 5000 znaków");
    expect(draftPhrase(409)).toContain("Ktoś w międzyczasie zmienił");
    expect(draftPhrase(0)).toBe("Brak połączenia z serwerem. Spróbuj ponownie.");
    expect(decisionPhrase(200, "publish")).toBe("Opublikowano pytanie i odpowiedź.");
    expect(decisionPhrase(200, "reject")).toContain("Nie będzie opublikowane");
    expect(decisionPhrase(200, "withdraw")).toContain("nie jest już widoczne");
    expect(decisionPhrase(200, "delete")).toBe("Usunięto pytanie na stałe.");
    expect(decisionPhrase(409, "reject")).toContain("Wczytano aktualny stan");
    expect(decisionPhrase(422, "publish")).toContain("nie kopią oryginału");
    expect(decisionPhrase(422, "withdraw")).toContain("w obecnym stanie");
    expect(decisionPhrase(403, "delete")).toBe("Brak uprawnień do tej czynności.");
    expect(readPhrase(404)).toBe("Nie znaleziono elementu. Odśwież listę.");
    expect(UNSAVED_PHRASE).toContain("Zapisz szkic");
  });
});

describe("exact wording", () => {
  it("labels every status and decision", ({ expect }) => {
    expect(QUESTION_STATUS_LABELS).toEqual({
      received: "Nowe",
      draft: "Szkic odpowiedzi",
      published: "Opublikowane",
      rejected: "Odrzucone",
      withdrawn: "Wycofane",
    });
    expect(
      [
        ...decisionActions(detail({ status: "draft" })),
        ...decisionActions(detail({ status: "published" })),
      ].map((spec) => [spec.action, spec.label, spec.confirm]),
    ).toEqual([
      ["publish", "Opublikuj pytanie i odpowiedź", "Tak, opublikuj"],
      ["reject", "Odrzuć pytanie", "Tak, odrzuć"],
      ["delete", "Usuń na stałe", "Tak, usuń na stałe"],
      ["withdraw", "Wycofaj publikację", "Tak, wycofaj"],
    ]);
    expect(decisionActions(detail({ status: "published" }))[0]?.warning).toBe(
      "Pytanie i odpowiedź znikną ze strony. Szkic zostanie w panelu i będzie można go poprawić albo odrzucić.",
    );
  });

  it("keeps the count when more pages remain and falls back for other errors", ({ expect }) => {
    expect(listPhrase(3, "all", true)).toBe("Pytań na liście: 3.");
    expect(decisionPhrase(500, "publish")).toBe(readPhrase(500));
    expect(decisionPhrase(0, "publish")).toBe("Brak połączenia z serwerem. Spróbuj ponownie.");
  });
});
