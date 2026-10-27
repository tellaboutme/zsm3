import type { News, PublicationStatus } from "@zsm3/contracts/content";

import type { BlocksUi } from "./blocks-ui.ts";
import { areaButton, fieldText, inputValue, setInputValue, speak } from "./dom.ts";
import { newsPartsFor, type NewsParts } from "./news-parts.ts";
import { applyPublish, syncPublish, type SavedState } from "./news-publish.ts";
import { panelRead, panelSend, problemPhrase } from "../../lib/panel/api.ts";
import { newBlock, type BlockDraft } from "../../lib/panel/blocks.ts";
import { drafts as draftBlocks } from "../../lib/panel/document.ts";
import { PANEL_SCHEMAS, parse, type PanelNewsItem } from "../../lib/panel/models.ts";
import { newsSave, newsStatus } from "../../lib/panel/mutations.ts";
import { newsCandidate } from "../../lib/panel/news-edit.ts";
import { slugify } from "../../lib/panel/slug.ts";

const STRINGS: readonly string[] = [
  "slug",
  "date",
  "category",
  "title",
  "lead",
  "caption",
  "credit",
];
const SIGN: readonly string[] = ["slug", "date"];

const EMPTY_BLOCKS: readonly BlockDraft[] = [newBlock("paragraph")];

export interface NewsForm {
  readonly open: (ref: string) => void;
}

type Parts = NewsParts;

function noteOf(parts: Parts, text: string): void {
  const status = parts.status;
  status.textContent = text;
}

function fieldsOf(parts: Parts): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of STRINGS) {
    values[name] = inputValue(parts.form, name);
  }
  return values;
}

function lockIdentity(parts: Parts, locked: boolean): void {
  for (const name of SIGN) {
    const control = fieldText(parts.form, name);
    if (control !== undefined) {
      control.disabled = locked;
    }
  }
}

function releaseForm(parts: Parts, values: Record<string, string>): void {
  const form = parts.form;
  for (const name of STRINGS) {
    setInputValue(form, name, values[name] ?? "");
  }
}

function resetForm(parts: Parts, saved: SavedState): void {
  releaseForm(parts, {});
  const ref = parts.ref;
  ref.year = "";
  ref.slug = "";
  ref.touched = false;
  lockIdentity(parts, false);
  parts.blocks.load(EMPTY_BLOCKS);
  applyPublish(parts, "draft", saved);
}

function fillItem(parts: Parts, item: PanelNewsItem, saved: SavedState): void {
  const ref = parts.ref;
  ref.year = item.date.slice(0, 4);
  ref.slug = item.slug;
  ref.touched = true;
  lockIdentity(parts, true);
  releaseForm(parts, {
    slug: item.slug,
    date: item.date,
    category: item.category,
    title: item.title,
    lead: item.lead,
    caption: item.cover?.caption ?? "",
    credit: item.cover?.credit ?? "",
  });
  parts.blocks.load(draftBlocks(item.body));
  applyPublish(parts, item.status, saved);
}

function markSaved(parts: Parts, item: News): void {
  const ref = parts.ref;
  ref.year = item.date.slice(0, 4);
  ref.slug = item.slug;
  lockIdentity(parts, true);
}

async function loadInto(parts: Parts, ref: string, saved: SavedState): Promise<void> {
  resetForm(parts, saved);
  if (ref.length === 0) {
    noteOf(parts, "Nowa aktualność (szkic).");
    return;
  }
  noteOf(parts, "Wczytywanie aktualności…");
  const response = await panelRead(`/api/panel/news/${ref}`);
  const view = parse(PANEL_SCHEMAS.newsView, response.data);
  if (view === undefined) {
    noteOf(parts, problemPhrase(response.status));
    return;
  }
  fillItem(parts, view.item, saved);
}

async function commit(parts: Parts, saved: SavedState): Promise<void> {
  const candidate = newsCandidate(fieldsOf(parts), parts.blocks.drafts());
  if (!candidate.ok || candidate.item === undefined) {
    speak(parts.status, candidate.issues);
    return;
  }
  const ref = parts.ref;
  const freshly = ref.slug.length === 0;
  const payload = newsSave(candidate.item);
  const path = `/api/panel/news/${ref.year}/${ref.slug}`;
  const response = freshly
    ? await panelSend("POST", "/api/panel/news", payload)
    : await panelSend("PUT", path, payload);
  if (!response.ok) {
    noteOf(parts, problemPhrase(response.status));
    return;
  }
  if (freshly) {
    markSaved(parts, candidate.item);
  }
  await syncPublish(parts, path, saved);
  parts.onSaved();
}

async function switchStatus(
  parts: Parts,
  action: "publish" | "unpublish",
  saved: SavedState,
): Promise<void> {
  const ref = parts.ref;
  if (ref.slug.length === 0) {
    noteOf(parts, "Najpierw zapisz aktualność.");
    return;
  }
  const path = `/api/panel/news/${ref.year}/${ref.slug}`;
  const response = await panelSend("PATCH", path, newsStatus(action));
  if (!response.ok) {
    noteOf(parts, problemPhrase(response.status));
    return;
  }
  const current: PublicationStatus = action === "publish" ? "published" : "draft";
  applyPublish(parts, current, saved);
  noteOf(parts, action === "publish" ? "Opublikowano." : "Wycofano publikację.");
  parts.onSaved();
}

function wireSlug(parts: Parts): void {
  const slugInput = fieldText(parts.form, "slug");
  const titleInput = fieldText(parts.form, "title");
  if (slugInput === undefined || titleInput === undefined) {
    return;
  }
  slugInput.addEventListener("input", () => {
    const ref = parts.ref;
    ref.touched = true;
  });
  titleInput.addEventListener("input", () => {
    const ref = parts.ref;
    if (!ref.touched) {
      slugInput.value = slugify(titleInput.value);
    }
  });
}

export function wireEditor(section: HTMLElement, blocks: BlocksUi, onSaved: () => void): NewsForm {
  const parts = newsPartsFor(section, blocks, onSaved);
  const saved: SavedState = { status: "draft" };
  areaButton(section, "news-save").addEventListener("click", () => {
    void commit(parts, saved);
  });
  const publish = parts.publish;
  const unpublish = parts.unpublish;
  publish.addEventListener("click", () => {
    void switchStatus(parts, "publish", saved);
  });
  unpublish.addEventListener("click", () => {
    void switchStatus(parts, "unpublish", saved);
  });
  wireSlug(parts);
  return {
    open: (ref) => {
      const bag = parts.ref;
      bag.year = "";
      bag.slug = "";
      bag.touched = false;
      void loadInto(parts, ref, saved);
    },
  };
}
