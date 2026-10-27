import { it } from "vitest";

import {
  CONNECTION_PHRASE,
  CONNECTION_STATUS,
  problemPhrase,
  panelRead,
} from "../src/lib/panel/api.ts";
import {
  canEditContent,
  CONTENT_ROLES,
  gateDecision,
  gatePhrases,
  rolePhrase,
} from "../src/lib/panel/gate.ts";
import { validationPhrases } from "../src/lib/panel/validation.ts";

it("decides the gate from the /me status and payload", ({ expect }) => {
  expect(gateDecision(200, "redaktor@zsm3.pl")).toBe("ready");
  expect(gateDecision(200, "")).toBe("error");
  expect(gateDecision(200, 7)).toBe("error");
  expect(gateDecision(401, undefined)).toBe("anonymous");
  expect(gateDecision(403, undefined)).toBe("denied");
  expect(gateDecision(500, undefined)).toBe("error");
});

it("labels roles and permissions", ({ expect }) => {
  expect(CONTENT_ROLES).toEqual(["admin", "secretariat", "editor"]);
  expect(canEditContent("admin")).toBe(true);
  expect(canEditContent("secretariat")).toBe(true);
  expect(canEditContent("editor")).toBe(true);
  expect(rolePhrase("editor")).toBe("redaktor treści");
  expect(canEditContent("gallery_editor")).toBe(false);
  expect(rolePhrase("gallery_editor")).toBe("redaktor galerii");
  expect(rolePhrase("nieznana")).toBeUndefined();
});

it("phrases every gate state in Polish", ({ expect }) => {
  expect(gatePhrases("loading")).toEqual(["Sprawdzam dostęp do panelu…"]);
  expect(gatePhrases("ready")).toEqual([]);
  expect(gatePhrases("anonymous")[0]).toContain("Cloudflare Access");
  expect(gatePhrases("denied")[0]).toBe("Brak uprawnień do treści.");
  expect(gatePhrases("error")[0] ?? "").toContain("nie odpowiada");
});

it("phrases problem statuses", ({ expect }) => {
  expect(problemPhrase(401)).toContain("Sesja");
  expect(problemPhrase(403)).toContain("uprawnień");
  expect(problemPhrase(404)).toContain("Nie znaleziono");
  expect(problemPhrase(413)).toContain("limit 100 MB");
  expect(problemPhrase(422)).toContain("nie przyjął");
  expect(problemPhrase(503)).toBe("Nieoczekiwana odpowiedź serwera. Spróbuj ponownie.");
  expect(CONNECTION_STATUS).toBe(0);
  expect(CONNECTION_PHRASE).toContain("Brak połączenia");
});

it("reads live panel data from the API", async ({ expect }) => {
  await expect(panelRead("http://127.0.0.1:1/none")).resolves.toMatchObject({
    status: CONNECTION_STATUS,
    ok: false,
    data: undefined,
  });
});

it("summarizes validation issues in Polish", ({ expect }) => {
  const makeIssue = (code: string, path: unknown): { code: string; path: unknown } => ({
    code,
    path,
  });
  expect(validationPhrases([makeIssue("expected_min", ["title"])])).toEqual([
    "Tytuł: wartość jest za krótka",
  ]);
  expect(validationPhrases([makeIssue("too_big", ["lead"])])).toEqual([
    "Lead: wartość jest za długa",
  ]);
  expect(validationPhrases([makeIssue("unrecognized_keys", [])])).toEqual([
    "pole nie przyjmuje tego wpisu",
  ]);
  const custom = validationPhrases([makeIssue("custom", ["x"])]);
  expect(custom[0]).toBe("sprawdź wartość");
  const numbered = validationPhrases([makeIssue("invalid_format", [0])]);
  expect(numbered[0]).toBe("wartość ma zły format");
  const symbolled = validationPhrases([makeIssue("invalid_format", [Symbol("w")])]);
  expect(symbolled[0]).toBe("wartość ma zły format");
  expect(validationPhrases([])).toEqual([]);
});

it("limits the summary to five phrases", ({ expect }) => {
  const issues = ["a", "b", "c", "d", "e", "f"].map((code) => ({
    code,
    path: ["slug"],
  }));
  expect(validationPhrases(issues)).toHaveLength(5);
});
