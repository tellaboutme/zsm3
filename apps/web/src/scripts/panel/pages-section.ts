import { el } from "./dom.ts";
import type { SectionDraft, SectionRow } from "../../lib/panel/page-edit.ts";

function idField(section: SectionDraft): HTMLElement {
  return el("label", {
    text: "Identyfikator",
    children: [
      el("input", { attributes: { "data-part": "id", maxlength: "120", value: section.id } }),
    ],
  });
}

function titleField(section: SectionDraft): HTMLElement {
  return el("label", {
    text: "Tytuł",
    children: [
      el("input", { attributes: { "data-part": "title", maxlength: "200", value: section.title } }),
    ],
  });
}

export function sectionNode(section: SectionDraft): HTMLFieldSetElement {
  const node = document.createElement("fieldset");
  node.className = "panel-section";
  node.append(el("legend", { text: "Sekcja" }));
  node.append(idField(section), titleField(section));
  node.append(
    el("ul", { attributes: { "data-panel": "blocks-list" } }),
    el("select", { attributes: { "data-panel": "blocks-kind" } }),
    el("button", {
      attributes: { "data-panel": "blocks-add", type: "button" },
      text: "Dodaj blok",
    }),
    el("ul", { className: "panel-kept" }),
  );
  return node;
}

export function keptList(node: HTMLElement, rows: readonly SectionRow[]): void {
  const keptUl = node.querySelector<HTMLUListElement>("ul.panel-kept");
  if (keptUl === null) {
    return;
  }
  const items = rows.flatMap((row) => (row.rich ? [] : [el("li", { text: row.label })]));
  keptUl.replaceChildren(...items);
}
