import type { RichText } from "@zsm3/contracts/rich-text";

export interface Cover {
  readonly caption: string;
  readonly credit?: string;
}

export interface NewsItem {
  readonly slug: string;
  readonly date: string;
  readonly category: string;
  readonly title: string;
  readonly lead: string;
  readonly body: RichText;
  readonly cover?: Cover;
}

export interface Category {
  readonly name: string;
  readonly slug: string;
}

export interface Page<Item> {
  readonly items: readonly Item[];
  readonly page: number;
  readonly pages: number;
}

export interface Neighbours {
  readonly newer: NewsItem | undefined;
  readonly older: NewsItem | undefined;
}

export const NEWS_PAGE_SIZE = 9;

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

export function latestNews(items: readonly NewsItem[], count: number): readonly NewsItem[] {
  return items.toSorted((first, second) => second.date.localeCompare(first.date)).slice(0, count);
}

export function newsCategories(items: readonly NewsItem[]): readonly Category[] {
  return [...new Set(items.map((item) => item.category))]
    .toSorted((first, second) => first.localeCompare(second, "pl"))
    .map((name) => ({ name, slug: slugify(name) }));
}

export function newsYears(items: readonly NewsItem[]): readonly string[] {
  return [...new Set(items.map(newsYear))].toSorted().toReversed();
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

export function laterPages(total: number, size: number): readonly number[] {
  return [...Array.from({ length: pageCount(total, size) }).keys()]
    .slice(1)
    .map((index) => index + 1);
}

export function paginate<Item>(items: readonly Item[], page: number, size: number): Page<Item> {
  const pages = pageCount(items.length, size);
  if (!Number.isInteger(page) || page < 1 || page > pages) {
    throw new RangeError(`Page ${String(page)} is outside 1–${String(pages)}`);
  }
  return { items: items.slice((page - 1) * size, page * size), page, pages };
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

export function neighbours(items: readonly NewsItem[], item: NewsItem): Neighbours {
  const ordered = latestNews(items, items.length);
  const index = ordered.findIndex((candidate) => candidate.slug === item.slug);
  return { newer: ordered[index - 1], older: ordered[index + 1] };
}

export function relatedNews(
  items: readonly NewsItem[],
  item: NewsItem,
  count: number,
): readonly NewsItem[] {
  const others = latestNews(items, items.length).filter(
    (candidate) => candidate.slug !== item.slug,
  );
  return [
    ...others.filter((candidate) => candidate.category === item.category),
    ...others.filter((candidate) => candidate.category !== item.category),
  ].slice(0, count);
}
