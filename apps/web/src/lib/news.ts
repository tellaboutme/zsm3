import type { News } from "@zsm3/contracts/content";

export type NewsItem = News;

export interface Category {
  readonly name: string;
  readonly slug: string;
}

export interface Page<Item> {
  readonly items: readonly Item[];
  readonly page: number;
  readonly pages: number;
}

export const NEWS_PAGE_SIZE = 9;

const PAGE_PARAM = /^[1-9]\d{0,3}$/u;
const YEAR_PARAM = /^\d{4}$/u;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ł", "l")
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

export function newsYear({ date }: NewsItem): string {
  return date.slice(0, 4);
}

export function newsHref(item: NewsItem): string {
  return `/aktualnosci/${newsYear(item)}/${item.slug}`;
}

export function categoryHref({ slug }: Category): string {
  return `/aktualnosci/kategoria/${slug}`;
}

export function toCategory(name: string): Category {
  return { name, slug: slugify(name) };
}

export function sortedCategories(names: readonly string[]): readonly Category[] {
  return names.toSorted((first, second) => first.localeCompare(second, "pl")).map(toCategory);
}

export function isYearParam(value: string | undefined): value is string {
  return value !== undefined && YEAR_PARAM.test(value);
}

export function parsePageParam(value: string | undefined): number | undefined {
  if (value === undefined) {
    return 1;
  }
  const page = PAGE_PARAM.test(value) ? Number(value) : 0;
  return page > 1 ? page : undefined;
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

export function pageHref(base: string, page: number): string {
  return page === 1 ? base : `${base}/strona/${String(page)}`;
}

export function pageWindow(current: number, total: number): readonly (number | null)[] {
  const shown = [...new Set([1, current - 1, current, current + 1, total])].filter(
    (page) => page >= 1 && page <= total,
  );
  return shown.flatMap((page, index) => {
    const previous = shown[index - 1];
    return previous !== undefined && page - previous > 1 ? [null, page] : [page];
  });
}
