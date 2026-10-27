import { it } from "vitest";

import { DATASET_FORMS, datasetForm } from "../src/lib/panel/dataset-forms.ts";
import {
  emptyValue,
  isBlank,
  issueLocation,
  issuePhrase,
  linesOf,
  textOrAbsent,
  type RootSpec,
} from "../src/lib/panel/forms.ts";

const ROOT: RootSpec = {
  kind: "list",
  name: "groups",
  label: "Grupy",
  itemLabel: "Grupa",
  fields: [
    { kind: "text", name: "title", label: "Nazwa", max: 10 },
    {
      kind: "list",
      name: "people",
      label: "Osoby",
      itemLabel: "Osoba",
      fields: [{ kind: "text", name: "role", label: "Funkcja", max: 10 }],
    },
    {
      kind: "object",
      name: "meta",
      label: "Dane",
      fields: [{ kind: "date", name: "updated", label: "Data" }],
    },
  ],
};

it("splits and trims lines and optional text", ({ expect }) => {
  expect(linesOf(" a \n\n b\n")).toEqual(["a", "b"]);
  expect(textOrAbsent("  ")).toBeUndefined();
  expect(textOrAbsent(" x ")).toBe("x");
});

it("starts every kind of field empty", ({ expect }) => {
  expect(emptyValue({ kind: "object", name: "o", label: "O", fields: ROOT.fields })).toEqual({
    title: "",
    people: [],
    meta: { updated: "" },
  });
  expect(emptyValue({ kind: "lines", name: "l", label: "L" })).toEqual([]);
  expect(emptyValue({ kind: "file", name: "f", label: "F" })).toBeUndefined();
  expect(emptyValue({ kind: "time", name: "t", label: "T" })).toBe("");
  expect(
    emptyValue({ kind: "select", name: "s", label: "S", options: [{ value: "a", label: "A" }] }),
  ).toBe("a");
  expect(emptyValue({ kind: "select", name: "s", label: "S", options: [] })).toBe("");
  expect(
    emptyValue({
      kind: "select",
      name: "s",
      label: "S",
      options: [{ value: "a", label: "A" }],
      optional: true,
    }),
  ).toBeUndefined();
  expect(
    emptyValue({ kind: "object", name: "o", label: "O", fields: [], optional: true }),
  ).toBeUndefined();
  expect(emptyValue({ kind: "checkbox", name: "c", label: "C" })).toBe(false);
  expect(emptyValue({ kind: "number", name: "n", label: "N", min: 1, max: 6 })).toBe("");
  expect(isBlank({ a: "", b: undefined })).toBe(true);
  expect(isBlank({ a: "", b: "x" })).toBe(false);
});

it("names the place of a validation problem in Polish", ({ expect }) => {
  expect(issueLocation(ROOT, [1, "people", 0, "role"])).toBe("Grupa 2 › Osoby › Osoba 1 › Funkcja");
  expect(issueLocation(ROOT, [0, "meta", "updated"])).toBe("Grupa 1 › Dane › Data");
  expect(issueLocation(ROOT, [0, "nieznane", 3])).toBe("Grupa 1");
  expect(issuePhrase(ROOT, { code: "too_small", path: [0, "title"] })).toBe(
    "Grupa 1 › Nazwa: pole jest puste albo za krótkie.",
  );
  expect(issuePhrase(ROOT, { code: "unrecognized_keys", path: [] })).toBe(
    "Popraw dane: nieprawidłowa wartość.",
  );
});

it("offers one form for every dataset", ({ expect }) => {
  expect(DATASET_FORMS.map((form) => form.key)).toEqual([
    "kadra",
    "wywiadowki",
    "kontakty",
    "dokumenty",
    "partnerzy",
    "oferty-pracy",
    "kierunki",
    "nawigacja",
  ]);
  expect(datasetForm("partnerzy")?.page).toBe("/");
  expect(datasetForm("brak")).toBeUndefined();
});
