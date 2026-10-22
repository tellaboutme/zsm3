import type { Neighbours, NewsFilter, NewsRepo } from "@zsm3/worker/storage/news-repo.ts";

import {
  isYearParam,
  NEWS_PAGE_SIZE,
  pageCount,
  parsePageParam,
  sortedCategories,
  toCategory,
  type Category,
  type NewsItem,
  type Page,
} from "./news.ts";

export type NewsReader = Omit<NewsRepo, "save">;

export interface ListingScope {
  readonly category?: string | undefined;
  readonly year?: string | undefined;
}

export interface Listing {
  readonly page: Page<NewsItem>;
  readonly categories: readonly Category[];
  readonly years: readonly string[];
  readonly category: Category | undefined;
}

export interface Article {
  readonly item: NewsItem;
  readonly category: Category;
  readonly neighbours: Neighbours;
  readonly related: readonly NewsItem[];
}

export const RELATED_COUNT = 3;

interface ResolvedScope {
  readonly filter: NewsFilter;
  readonly categories: readonly Category[];
  readonly years: readonly string[];
  readonly category: Category | undefined;
}

async function resolveScope(
  reader: NewsReader,
  scope: ListingScope,
): Promise<ResolvedScope | undefined> {
  const [names, years] = await Promise.all([reader.categories(), reader.years()]);
  const categories = sortedCategories(names);
  const category = categories.find((entry) => entry.slug === scope.category);
  const knownCategory = scope.category === undefined || category !== undefined;
  const knownYear = scope.year === undefined || years.includes(scope.year);
  if (!knownCategory || !knownYear) {
    return undefined;
  }
  const filter: NewsFilter = {
    ...(category === undefined ? {} : { category: category.name }),
    ...(scope.year === undefined ? {} : { year: scope.year }),
  };
  return { filter, categories, years, category };
}

export async function loadListing(
  reader: NewsReader,
  scope: ListingScope,
  pageParam: string | undefined,
): Promise<Listing | undefined> {
  const page = parsePageParam(pageParam);
  const resolved = page === undefined ? undefined : await resolveScope(reader, scope);
  if (page === undefined || resolved === undefined) {
    return undefined;
  }
  const pages = pageCount(await reader.countPublished(resolved.filter), NEWS_PAGE_SIZE);
  if (page > pages) {
    return undefined;
  }
  const offset = (page - 1) * NEWS_PAGE_SIZE;
  const items = await reader.published(resolved.filter, { limit: NEWS_PAGE_SIZE, offset });
  const { categories, years, category } = resolved;
  return { page: { items, page, pages }, categories, years, category };
}

export async function loadArticle(
  reader: NewsReader,
  year: string | undefined,
  slug: string | undefined,
): Promise<Article | undefined> {
  const item = isYearParam(year) && slug !== undefined ? await reader.find(year, slug) : undefined;
  if (item === undefined) {
    return undefined;
  }
  const [neighbours, related] = await Promise.all([
    reader.neighbours(item),
    reader.related(item, RELATED_COUNT),
  ]);
  return { item, category: toCategory(item.category), neighbours, related };
}

export async function latestNews(reader: NewsReader, count: number): Promise<readonly NewsItem[]> {
  return reader.published({}, { limit: count, offset: 0 });
}
