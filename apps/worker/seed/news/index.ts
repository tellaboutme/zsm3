import { newsSchema, type News } from "@zsm3/contracts/content";

import { octoberEarly } from "./october-early.ts";
import { octoberLate } from "./october-late.ts";
import { september } from "./september.ts";

export const seedNews: readonly News[] = [...octoberLate, ...octoberEarly, ...september].map(
  (item) => newsSchema.parse(item),
);
