export interface NewsItem {
  readonly slug: string;
  readonly date: string;
  readonly category: string;
  readonly title: string;
  readonly lead: string;
}

export function newsHref({ slug, date }: NewsItem): string {
  return `/aktualnosci/${date.slice(0, 4)}/${slug}`;
}

export function latestNews(items: readonly NewsItem[], count: number): readonly NewsItem[] {
  return items.toSorted((first, second) => second.date.localeCompare(first.date)).slice(0, count);
}
