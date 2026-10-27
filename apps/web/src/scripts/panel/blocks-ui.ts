import { controlOf, FIELDS, fieldValueOf } from "./blocks-fields.ts";
import { areaButton, areaList, areaSelect, button, el } from "./dom.ts";
import {
  blockLabels,
  blockKinds,
  blockKindOf,
  draftFromFields,
  fieldValues,
  insertedBlock,
  movedBlock,
  removedBlock,
  type BlockDraft,
} from "../../lib/panel/blocks.ts";

function fieldsOf(row: HTMLElement): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const node of row.querySelectorAll<HTMLElement>(":scope [data-field]")) {
    const name = node.dataset["field"];
    if (name !== undefined) {
      fields[name] = fieldValueOf(row, name);
    }
  }
  return fields;
}

function collectRow(row: HTMLElement): BlockDraft {
  return draftFromFields(blockKindOf(row.dataset["kind"]), fieldsOf(row));
}

function rowsOf(list: HTMLUListElement): readonly BlockDraft[] {
  const drafts: BlockDraft[] = [];
  for (const row of list.children) {
    if (row instanceof HTMLElement) {
      drafts.push(collectRow(row));
    }
  }
  return drafts;
}

function render(list: HTMLUListElement, drafts: readonly BlockDraft[]): void {
  list.replaceChildren(...drafts.map((draft, index) => rowNode(list, draft, index)));
}

function rowNode(list: HTMLUListElement, draft: BlockDraft, index: number): HTMLElement {
  const kind = draft.kind;
  const mark = `${blockLabels[kind]} ${String(index + 1)}`;
  const head = el("div", {
    className: "panel-block-head",
    children: [
      el("b", { text: mark }),
      moveOne(list, mark, -1),
      moveOne(list, mark, 1),
      removeOne(list, mark),
    ],
  });
  const specs = FIELDS[kind];
  const fields = specs.map((spec) =>
    el("label", {
      text: spec.label,
      children: [controlOf(spec, fieldValues(draft)[spec.name] ?? "")],
    }),
  );
  return el("li", {
    className: "panel-block",
    attributes: { "data-block-kind": kind },
    children: [head, ...fields],
  });
}

function moveOne(list: HTMLUListElement, mark: string, delta: -1 | 1): HTMLElement {
  const node = button(delta < 0 ? "Wyżej" : "Niżej", "panel-move");
  node.setAttribute("aria-label", `${delta < 0 ? "Wyżej" : "Niżej"} — ${mark}`);
  node.addEventListener("click", () => {
    render(list, movedBlock(rowsOf(list), indexOf(list, node), delta));
  });
  return node;
}

function removeOne(list: HTMLUListElement, mark: string): HTMLElement {
  const node = button("Usuń", "panel-remove");
  node.setAttribute("aria-label", `Usuń — ${mark}`);
  node.addEventListener("click", () => {
    render(list, removedBlock(rowsOf(list), indexOf(list, node)));
  });
  return node;
}

function indexOf(list: HTMLUListElement, node: HTMLElement): number {
  const row = node.closest("li");
  let index = -1;
  for (const child of list.children) {
    index += 1;
    if (child === row) {
      return index;
    }
  }
  return -1;
}

export interface BlocksUi {
  readonly drafts: () => readonly BlockDraft[];
  readonly load: (drafts: readonly BlockDraft[]) => void;
}

export function wireBlocks(root: HTMLElement): BlocksUi {
  const list = areaList(root, "blocks-list");
  fillKind(areaSelect(root, "blocks-kind"));
  areaButton(root, "blocks-add").addEventListener("click", () => {
    const kind = blockKindOf(areaSelect(root, "blocks-kind").value);
    render(list, insertedBlock(rowsOf(list), rowsOf(list).length, kind));
  });
  return {
    drafts: () => rowsOf(list),
    load: (drafts) => {
      render(list, drafts);
    },
  };
}

function fillKind(kindSelect: HTMLSelectElement): void {
  kindSelect.replaceChildren(
    ...blockKinds.map((kind) => {
      const node = document.createElement("option");
      node.value = kind;
      node.textContent = blockLabels[kind];
      return node;
    }),
  );
}
