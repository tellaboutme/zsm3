import { richTextSchema } from "@zsm3/contracts/rich-text";

import { octoberEarly } from "./october-early.ts";
import { octoberLate } from "./october-late.ts";
import { september } from "./september.ts";
import type { NewsItem } from "../../lib/news.ts";

export const news: readonly NewsItem[] = [...octoberLate, ...octoberEarly, ...september].map(
  (item) => ({ ...item, body: richTextSchema.parse(item.body) }),
);
