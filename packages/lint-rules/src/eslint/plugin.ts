import type { ESLint } from "eslint";

import { noComments } from "./no-comments.ts";

export const localPlugin = {
  meta: { name: "@zsm3/lint-rules" },
  rules: { "no-comments": noComments },
} satisfies ESLint.Plugin;
