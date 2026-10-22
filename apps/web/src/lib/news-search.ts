import { plainText } from "@zsm3/contracts/rich-text";

import { newsHref, type NewsItem } from "./news.ts";
import type { SearchEntry } from "./search.ts";

export const SEARCH_NEWS_LIMIT = 100;

export function newsEntry(item: NewsItem): SearchEntry {
  return {
    type: "aktualnosc",
    title: item.title,
    href: newsHref(item),
    text: `${item.category} ${item.lead} ${plainText(item.body)}`,
  };
}
