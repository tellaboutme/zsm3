import type { ContentBlock, ContentPage, PublicationStatus } from "@zsm3/contracts/content";

import { wireBlocks, type BlocksUi } from "./blocks-ui.ts";
import { area, areaButton, areaForm, button, inputValue, setInputValue, speak } from "./dom.ts";
import { keptList, sectionNode } from "./pages-section.ts";
import { panelRead, panelSend, problemPhrase } from "../../lib/panel/api.ts";
import { PANEL_SCHEMAS, parse, type PanelPageView } from "../../lib/panel/models.ts";
import { pageSave } from "../../lib/panel/mutations.ts";
import {
  emptySection,
  keptLabel,
  pageCandidate,
  pageDrafts,
  type PageDraft,
  type SectionDraft,
  type SectionRow,
} from "../../lib/panel/page-edit.ts";
import { savedRevision } from "../../lib/panel/revisions.ts";

export interface PageForm {
  readonly open: (path: string) => void;
}

interface Parts {
  readonly form: HTMLFormElement;
  readonly status: HTMLElement;
  readonly sections: HTMLElement;
  readonly editors: Map<HTMLElement, BlocksUi>;
  readonly kept: Map<HTMLElement, readonly ContentBlock[]>;
  readonly loaded: LoadedVersion;
  readonly onSaved: (path: string) => void;
}

interface LoadedVersion {
  path: string;
  revision: number | null;
}

const NAMES: readonly string[] = ["path", "kicker", "title", "intro"];

function partsFor(section: HTMLElement, onSaved: (path: string) => void): Parts {
  return {
    form: areaForm(section, "page-form"),
    status: area(section, "form-status"),
    sections: area(section, "sections"),
    editors: new Map(),
    kept: new Map(),
    loaded: { path: "", revision: null },
    onSaved,
  };
}

function noteOf(parts: Parts, text: string): void {
  const status = parts.status;
  status.textContent = text;
}

function partText(child: HTMLElement, name: string): string {
  return child.querySelector<HTMLInputElement>(`[data-part="${name}"]`)?.value ?? "";
}

function sectionDraft(child: HTMLElement, parts: Parts, index: number): SectionDraft {
  const editor = parts.editors.get(child) ?? wireBlocks(child);
  const rows: SectionRow[] = [{ rich: true, drafts: editor.drafts() }];
  for (const block of parts.kept.get(child) ?? []) {
    rows.push({ rich: false, block, label: keptLabel(block.type) });
  }
  const id = partText(child, "id");
  const header = id.length === 0 ? `sekcja-${String(index + 1)}` : id;
  return { id: header, title: partText(child, "title"), rows };
}

function sectionsOf(parts: Parts): readonly SectionDraft[] {
  const drafts: SectionDraft[] = [];
  let index = 0;
  for (const child of parts.sections.children) {
    if (child instanceof HTMLElement) {
      drafts.push(sectionDraft(child, parts, index));
      index += 1;
    }
  }
  return drafts;
}

function pageDraftOf(parts: Parts): PageDraft {
  const status = inputValue(parts.form, "status");
  return {
    path: inputValue(parts.form, "path"),
    kicker: inputValue(parts.form, "kicker"),
    title: inputValue(parts.form, "title"),
    intro: inputValue(parts.form, "intro"),
    status: status === "published" ? "published" : "draft",
    sections: sectionsOf(parts),
  };
}

function keptOf(rows: readonly SectionRow[]): readonly ContentBlock[] {
  return rows.flatMap((row) => (row.rich ? [] : [row.block]));
}

function removeButton(parts: Parts, node: HTMLElement): HTMLElement {
  const nodeButton = button("Usuń sekcję", "panel-remove-section");
  nodeButton.setAttribute("aria-label", "Usuń sekcję");
  nodeButton.addEventListener("click", () => {
    const bag = parts.editors;
    bag.delete(node);
    parts.kept.delete(node);
    node.remove();
    noteOf(parts, "Sekcję usunięto. Zapisz stronę.");
  });
  return nodeButton;
}

function addSection(parts: Parts, section: SectionDraft): void {
  const node = sectionNode(section);
  parts.sections.append(node);
  node.append(removeButton(parts, node));
  const editor = wireBlocks(node);
  parts.editors.set(node, editor);
  parts.kept.set(node, keptOf(section.rows));
  editor.load(section.rows.flatMap((row) => (row.rich ? [...row.drafts] : [])));
  keptList(node, section.rows);
}

function rebuildSections(parts: Parts, page: ContentPage, status: PublicationStatus): void {
  parts.editors.clear();
  parts.kept.clear();
  parts.sections.replaceChildren();
  for (const section of pageDrafts(page, status).sections) {
    addSection(parts, section);
  }
}

function applyView(parts: Parts, view: PanelPageView): void {
  const values: Record<string, string> = {
    path: view.item.path,
    kicker: view.item.kicker,
    title: view.item.title,
    intro: view.item.intro,
  };
  for (const [name, filled] of Object.entries(values)) {
    setInputValue(parts.form, name, filled);
  }
  const selector = parts.form.querySelector("select[name='status']");
  if (selector instanceof HTMLSelectElement) {
    selector.value = view.item.status;
  }
  rebuildSections(parts, view.item, view.item.status);
  noteOf(parts, "Wczytano stronę.");
}

function remember(parts: Parts, path: string, revision: number | null): void {
  const { loaded } = parts;
  loaded.path = path;
  loaded.revision = revision;
}

async function loadInto(parts: Parts, path: string): Promise<void> {
  remember(parts, "", null);
  parts.editors.clear();
  parts.kept.clear();
  parts.sections.replaceChildren();
  for (const name of NAMES) {
    setInputValue(parts.form, name, "");
  }
  if (path.length === 0) {
    addSection(parts, emptySection(0));
    noteOf(parts, "Nowa strona (szkic).");
    return;
  }
  noteOf(parts, "Wczytywanie strony…");
  const response = await panelRead(`/api/panel/pages${path}`);
  const view = parse(PANEL_SCHEMAS.pageView, response.data);
  if (view === undefined) {
    noteOf(parts, problemPhrase(response.status));
    return;
  }
  applyView(parts, view);
  remember(parts, view.item.path, view.revision);
}

async function commit(parts: Parts): Promise<void> {
  const candidate = pageCandidate(pageDraftOf(parts), {});
  if (!candidate.ok || candidate.page === undefined) {
    speak(parts.status, candidate.issues);
    return;
  }
  const status = inputValue(parts.form, "status") === "published" ? "published" : "draft";
  const { page } = candidate;
  const expected = parts.loaded.path === page.path ? parts.loaded.revision : null;
  const response = await panelSend(
    "PUT",
    `/api/panel/pages${page.path}`,
    pageSave(page, status, expected),
  );
  const revision = savedRevision(response.data);
  if (!response.ok || revision === undefined) {
    noteOf(parts, problemPhrase(response.status));
    return;
  }
  remember(parts, page.path, revision);
  noteOf(parts, "Zapisano stronę.");
  parts.onSaved(page.path);
}

export function wirePageForm(section: HTMLElement, onSaved: (path: string) => void): PageForm {
  const parts = partsFor(section, onSaved);
  areaButton(section, "pages-save").addEventListener("click", () => {
    void commit(parts);
  });
  areaButton(section, "section-add").addEventListener("click", () => {
    addSection(parts, emptySection(parts.sections.children.length));
  });
  return {
    open: (path) => {
      void loadInto(parts, path);
    },
  };
}
