import { snippet } from "../lib/search-snippet.ts";
import {
  groupResults,
  isSearchIndex,
  prepare,
  search,
  suggestion,
  type SearchIndex,
  type SearchEntry,
} from "../lib/search.ts";

interface SearchView {
  readonly input: HTMLInputElement;
  readonly status: Element;
  readonly target: HTMLElement;
  readonly hint: HTMLElement;
  readonly hintButton: HTMLButtonElement;
  readonly sync: boolean;
}

function element<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  text?: string,
): HTMLElementTagNameMap[Tag] {
  const node = document.createElement(tag);
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function excerpt(entry: SearchEntry, query: string): HTMLParagraphElement {
  const paragraph = element("p");
  paragraph.append(
    ...snippet(entry.text, query).map((segment) =>
      segment.marked ? element("mark", segment.text) : document.createTextNode(segment.text),
    ),
  );
  return paragraph;
}

function render(target: HTMLElement, results: readonly SearchEntry[], query: string): void {
  target.replaceChildren(
    ...groupResults(results).map((group) => {
      const section = element("section");
      const list = element("ul");
      for (const entry of group.entries) {
        const item = element("li");
        const link = element("a", entry.title);
        link.href = entry.href;
        item.append(link, excerpt(entry, query));
        list.append(item);
      }
      section.append(element("h2", `${group.label} (${String(group.entries.length)})`), list);
      return section;
    }),
  );
}

function statusText(query: string, count: number): string {
  if (query.length === 0) {
    return "";
  }
  const advice = count === 0 ? " Spróbuj innego słowa albo zajrzyj na mapę strony." : "";
  return `Wyniki dla „${query}”: ${String(count)}.${advice}`;
}

async function loadIndex(): Promise<SearchIndex> {
  const response = await fetch("/szukaj/indeks.json");
  const data: unknown = await response.json();
  return prepare(isSearchIndex(data) ? data : []);
}

function resultParts(root: HTMLElement): Omit<SearchView, "input" | "sync"> | undefined {
  const status = root.querySelector("[data-search-status]");
  const target = root.querySelector<HTMLElement>("[data-search-results]");
  const hint = root.querySelector<HTMLElement>("[data-search-suggestion]");
  const hintButton = root.querySelector<HTMLButtonElement>("[data-search-suggest]");
  if (status === null || target === null || hint === null || hintButton === null) {
    return undefined;
  }
  return { status, target, hint, hintButton };
}

function viewOf(): SearchView | undefined {
  const root = document.querySelector<HTMLElement>("[data-search-results-root]");
  const input = document.querySelector<HTMLInputElement>("[data-search-input]");
  const parts = root === null ? undefined : resultParts(root);
  if (root === null || input === null || parts === undefined) {
    return undefined;
  }
  return { ...parts, input, sync: root.hasAttribute("data-search-sync") };
}

function update(view: SearchView, index: SearchIndex): void {
  const query = view.input.value.trim();
  const results = search(index, query);
  const proposal = results.length === 0 ? suggestion(index, query) : undefined;
  const { target, status, hint, hintButton } = view;
  render(target, results, query);
  status.textContent = statusText(query, results.length);
  hint.hidden = proposal === undefined;
  hintButton.textContent = proposal ?? "";
  if (view.sync) {
    const url = new URL(location.href);
    url.searchParams.set("q", query);
    history.replaceState(null, "", query.length === 0 ? location.pathname : url);
  }
}

function bind(view: SearchView, index: () => Promise<SearchIndex>): void {
  const refresh = async (): Promise<void> => {
    update(view, await index());
  };
  view.input.addEventListener("input", () => {
    void refresh();
  });
  const { input, hintButton } = view;
  hintButton.addEventListener("click", () => {
    input.value = hintButton.textContent;
    void refresh();
    input.focus();
  });
  if (view.sync) {
    view.input.form?.addEventListener("submit", (event) => {
      event.preventDefault();
      void refresh();
    });
  }
}

function initSearch(): void {
  const view = viewOf();
  if (view === undefined) {
    return;
  }
  let loading: Promise<SearchIndex> | undefined;
  const index = async (): Promise<SearchIndex> => {
    loading ??= loadIndex();
    return loading;
  };
  bind(view, index);
  if (view.sync) {
    const { input } = view;
    input.value = new URLSearchParams(location.search).get("q") ?? "";
    void index().then((loaded) => {
      update(view, loaded);
    });
  }
}

initSearch();
