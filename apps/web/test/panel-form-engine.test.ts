import { datasetSchemas } from "@zsm3/contracts/datasets";
import type { StoredFile } from "@zsm3/contracts/media";
import { seedDatasets } from "@zsm3/worker/seed/datasets/index.ts";
import { it } from "vitest";

import "./panel-window.ts";
import { fallbackNavigation } from "../src/data/navigation.ts";
import { DATASET_FORMS } from "../src/lib/panel/dataset-forms.ts";
import { readField } from "../src/scripts/panel/form-read.ts";
import { renderField } from "../src/scripts/panel/form-render.ts";

function filesIn(value: unknown): readonly StoredFile[] {
  const keys = [...JSON.stringify(value).matchAll(/"href":"\/media\/(d\/[^"]+)","bytes":(\d+)/gu)];
  return keys.map((match) => ({
    key: String(match[1]),
    name: "plik.pdf",
    format: "pdf",
    bytes: Number(match[2]),
  }));
}

it("renders every dataset and reads the same data back", ({ expect }) => {
  for (const form of DATASET_FORMS) {
    const value = { ...seedDatasets, nawigacja: fallbackNavigation }[form.key];
    const node = renderField(form.root, value, { files: filesIn(value) });
    const read = datasetSchemas[form.key].parse(readField(form.root, node));
    expect(read, form.key).toEqual(value);
  }
});

function clickNamed(root: HTMLElement, label: string, index = 0): void {
  const buttons = [...root.querySelectorAll("button")].filter((node) => node.textContent === label);
  buttons[index]?.click();
}

it("adds, moves and removes list items", ({ expect }) => {
  const form = DATASET_FORMS.find((entry) => entry.key === "partnerzy");
  if (form === undefined) {
    throw new Error("fixture");
  }
  const partners = [
    { name: "A", role: "pierwszy" },
    { name: "B", role: "drugi" },
  ];
  const node = renderField(form.root, partners, { files: [] });
  const names = (): unknown => readField(form.root, node);

  clickNamed(node, "W dół");
  expect(names()).toEqual([partners[1], partners[0]]);
  clickNamed(node, "W górę", 1);
  expect(names()).toEqual(partners);
  clickNamed(node, "W górę", 0);
  clickNamed(node, "W dół", 1);
  expect(names()).toEqual(partners);
  clickNamed(node, "Dodaj: partner");
  expect(names()).toEqual([...partners, { name: "", role: "" }]);
  clickNamed(node, "Usuń: partner", 2);
  clickNamed(node, "Usuń: partner", 0);
  expect(names()).toEqual([partners[1]]);
});

it("reads optional files and fields as absent and survives odd input", ({ expect }) => {
  const form = DATASET_FORMS.find((entry) => entry.key === "oferty-pracy");
  if (form === undefined) {
    throw new Error("fixture");
  }
  const offer = { employer: "LS", position: "Mechanik", validUntil: "2026-12-31" };
  const node = renderField(form.root, [offer, "zły wpis"], { files: [] });
  expect(readField(form.root, node)).toEqual([
    offer,
    { employer: "", position: "", validUntil: "" },
  ]);
  const empty = renderField(form.root, "nie lista", { files: [] });
  expect(readField(form.root, empty)).toEqual([]);
  empty.querySelector("[data-items]")?.remove();
  expect(readField(form.root, empty)).toEqual([]);
});
