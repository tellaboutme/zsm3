import { contentPageSchema, type ContentPage } from "@zsm3/contracts/content";

import { historia } from "./historia.ts";
import { patron } from "./patron.ts";

export const seedPages: readonly ContentPage[] = [historia, patron].map((page) =>
  contentPageSchema.parse(page),
);
