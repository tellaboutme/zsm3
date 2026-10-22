import { groupResults, isSearchIndex, search, type SearchEntry } from "../lib/search.ts";

const SNIPPET_LENGTH = 160;

function snippet(text: string): string {
  return text.length > SNIPPET_LENGTH ? `${text.slice(0, SNIPPET_LENGTH).trimEnd()}…` : text;
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

function render(target: HTMLElement, results: readonly SearchEntry[]): void {
  target.replaceChildren(
    ...groupResults(results).map((group) => {
      const section = element("section");
      const list = element("ul");
      for (const entry of group.entries) {
        const item = element("li");
        const link = element("a", entry.title);
        link.href = entry.href;
        item.append(link, element("p", snippet(entry.text)));
        list.append(item);
      }
      section.append(element("h2", `${group.label} (${String(group.entries.length)})`), list);
      return section;
    }),
  );
}

async function loadIndex(): Promise<readonly SearchEntry[]> {
  const response = await fetch("/szukaj/indeks.json");
  const data: unknown = await response.json();
  return isSearchIndex(data) ? data : [];
}

async function initSearch(): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("[data-search-input]");
  const status = document.querySelector("[data-search-status]");
  const target = document.querySelector<HTMLElement>("[data-search-results]");
  if (input === null || status === null || target === null) {
    return;
  }
  const index = await loadIndex();
  const update = (): void => {
    const query = input.value.trim();
    const results = search(index, query);
    render(target, results);
    status.textContent =
      query.length === 0
        ? ""
        : `Wyniki dla „${query}”: ${String(results.length)}. ${results.length === 0 ? "Spróbuj innego słowa albo zajrzyj na mapę strony." : ""}`.trim();
    const url = new URL(location.href);
    url.searchParams.set("q", query);
    history.replaceState(null, "", query.length === 0 ? location.pathname : url);
  };
  input.value = new URLSearchParams(location.search).get("q") ?? "";
  input.addEventListener("input", update);
  input.form?.addEventListener("submit", (event) => {
    event.preventDefault();
    update();
  });
  update();
}

void initSearch();
