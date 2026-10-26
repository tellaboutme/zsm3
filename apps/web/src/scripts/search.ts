import { snippet } from "../lib/search-snippet.ts";
import { groupResults, isSearchReply, type SearchEntry, type SearchReply } from "../lib/search.ts";

const DEBOUNCE_MS = 150;

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

function emptyReply(): SearchReply {
  return { results: [] };
}

async function fetchReply(query: string, signal: AbortSignal): Promise<SearchReply> {
  const response = await fetch(`/szukaj/wyniki.json?q=${encodeURIComponent(query)}`, { signal });
  const data: unknown = await response.json();
  return isSearchReply(data) ? data : emptyReply();
}

function show(view: SearchView, reply: SearchReply): void {
  const query = view.input.value.trim();
  const { target, status, hint, hintButton } = view;
  render(target, reply.results, query);
  status.textContent = statusText(query, reply.results.length);
  hint.hidden = reply.suggestion === undefined;
  hintButton.textContent = reply.suggestion ?? "";
  if (view.sync) {
    const url = new URL(location.href);
    url.searchParams.set("q", query);
    history.replaceState(null, "", query.length === 0 ? location.pathname : url);
  }
}

function showCurrent(view: SearchView, query: string, reply: SearchReply): void {
  if (view.input.value.trim() === query) {
    show(view, reply);
  }
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

function listen(view: SearchView, update: () => Promise<void>): void {
  const { input, hintButton } = view;
  hintButton.addEventListener("click", () => {
    input.value = hintButton.textContent;
    void update();
    input.focus();
  });
  if (view.sync) {
    view.input.form?.addEventListener("submit", (event) => {
      event.preventDefault();
      void update();
    });
  }
}

function bind(view: SearchView): () => Promise<void> {
  let timer: number | undefined;
  let pending: AbortController | undefined;

  const update = async (): Promise<void> => {
    const query = view.input.value.trim();
    if (query.length === 0) {
      show(view, emptyReply());
      return;
    }
    pending?.abort();
    pending = new AbortController();
    try {
      showCurrent(view, query, await fetchReply(query, pending.signal));
    } catch {
      showCurrent(view, query, emptyReply());
    }
  };

  const schedule = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      void update();
    }, DEBOUNCE_MS);
  };

  view.input.addEventListener("input", schedule);
  listen(view, update);
  return update;
}

function initSearch(): void {
  const view = viewOf();
  if (view === undefined) {
    return;
  }
  const update = bind(view);
  if (view.sync) {
    view.input.value = new URLSearchParams(location.search).get("q") ?? "";
    void update();
  }
}

initSearch();
