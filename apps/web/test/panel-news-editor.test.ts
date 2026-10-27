import type { RichText } from "@zsm3/contracts/rich-text";
import { it, vi } from "vitest";

import "./panel-window.ts";
import { wireBlocks } from "../src/scripts/panel/blocks-ui.ts";
import { wireEditor } from "../src/scripts/panel/news-form.ts";

const NEWS_BODY: RichText = [
  {
    type: "paragraph",
    content: [
      { type: "text", text: "Dzień " },
      { type: "text", text: "otwarty", marks: ["bold"] },
      { type: "link", text: "program", href: "/kalendarz" },
    ],
  },
];

const ITEM_BASE = {
  slug: "dzien-otwarty",
  date: "2026-04-21",
  category: "Wydarzenia",
  title: "Dzień otwarty",
  lead: "Zapraszamy uczniów.",
  body: NEWS_BODY,
};

const VIEW = { item: { ...ITEM_BASE, status: "published" } };

interface Seen {
  readonly method: string;
  readonly path: string;
  readonly payload: unknown;
}

interface Answer {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: { readonly get: (name: string) => string };
  readonly json: () => unknown;
}

function jsonOf(data: unknown): Answer {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: () => data,
  };
}

function problemOf(status: number): Answer {
  return {
    ok: false,
    status,
    headers: { get: () => "application/problem+json" },
    json: () => ({ type: "about:blank", title: "problem", status }),
  };
}

function stubFetch(responses: readonly Answer[]): readonly Seen[] {
  const seen: { method: string; path: string; payload: unknown }[] = [];
  const queue = [...responses];
  const fetcher = (path: unknown, init?: RequestInit): unknown => {
    const method = init?.method ?? "GET";
    const raw = init?.body;
    seen.push({
      method,
      path: String(path),
      payload: typeof raw === "string" ? JSON.parse(raw) : raw,
    });
    return queue.shift() ?? problemOf(500);
  };
  vi.stubGlobal("fetch", fetcher);
  return seen;
}

function named(name: string): HTMLElement {
  const node = document.createElement("button");
  node.type = "button";
  node.dataset["panel"] = name;
  return node;
}

function buildSection(): HTMLElement {
  const section = document.createElement("section");
  const form = document.createElement("form");
  form.dataset["panel"] = "form";
  for (const name of ["slug", "date", "category", "title", "lead", "caption", "credit"]) {
    const input = document.createElement("input");
    input.name = name;
    form.append(input);
  }
  const root = document.createElement("div");
  root.dataset["panel"] = "blocks-root";
  const list = document.createElement("ul");
  list.dataset["panel"] = "blocks-list";
  const kind = document.createElement("select");
  kind.dataset["panel"] = "blocks-kind";
  root.append(list, kind, named("blocks-add"));
  const status = document.createElement("p");
  status.dataset["panel"] = "form-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  section.append(
    form,
    root,
    status,
    named("news-save"),
    named("news-publish"),
    named("news-unpublish"),
  );
  document.body.append(section);
  return section;
}

function part(section: HTMLElement, name: string): HTMLElement {
  const node = section.querySelector<HTMLElement>(`[data-panel="${name}"]`);
  if (node === null) {
    throw new Error(`missing ${name}`);
  }
  return node;
}

it("keeps the publish controls honest after saving a published article", async ({ expect }) => {
  const seen = stubFetch([jsonOf(VIEW), jsonOf({ ok: true }), jsonOf(VIEW)]);
  const saved: boolean[] = [];
  const section = buildSection();
  const editor = wireEditor(section, wireBlocks(part(section, "blocks-root")), () => {
    saved.push(true);
  });
  const publish = part(section, "news-publish");
  const unpublish = part(section, "news-unpublish");
  editor.open("2026/dzien-otwarty");
  await vi.waitFor(() => {
    expect(section.querySelector<HTMLTextAreaElement>('[data-field="text"]')?.value).toBe(
      "Dzień **otwarty**[program](/kalendarz)",
    );
  });
  expect(publish.hidden).toBe(true);
  expect(unpublish.hidden).toBe(false);
  part(section, "news-save").click();
  await vi.waitFor(() => {
    expect(part(section, "form-status").textContent).toContain("jest opublikowana");
  });
  expect(seen).toHaveLength(3);
  const put = seen.find((request) => request.method === "PUT");
  expect(put?.path).toBe("/api/panel/news/2026/dzien-otwarty");
  expect(put?.payload).toEqual({
    entity: "news",
    mutation: { action: "save", item: ITEM_BASE },
  });
  expect(publish.hidden).toBe(true);
  expect(unpublish.hidden).toBe(false);
  expect(part(section, "form-status").getAttribute("aria-live")).toBe("polite");
  expect(saved).toHaveLength(1);
});

it("admits an unknown publish state instead of guessing", async ({ expect }) => {
  const seen = stubFetch([jsonOf(VIEW), jsonOf({ ok: true }), problemOf(404)]);
  const saved: boolean[] = [];
  const section = buildSection();
  const editor = wireEditor(section, wireBlocks(part(section, "blocks-root")), () => {
    saved.push(true);
  });
  editor.open("2026/dzien-otwarty");
  await vi.waitFor(() => {
    expect(part(section, "news-unpublish").hidden).toBe(false);
  });
  part(section, "news-save").click();
  await vi.waitFor(() => {
    expect(part(section, "form-status").textContent).toContain("nieznany");
  });
  expect(part(section, "news-publish").hidden).toBe(true);
  expect(part(section, "news-unpublish").hidden).toBe(false);
  expect(seen).toHaveLength(3);
});
