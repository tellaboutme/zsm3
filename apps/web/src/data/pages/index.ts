import { richTextSchema } from "@zsm3/contracts/rich-text";

import { historia } from "./historia.ts";
import { patron } from "./patron.ts";
import type { ContentBlock, ContentPage } from "../../lib/content.ts";

function validated(block: ContentBlock): ContentBlock {
  return block.type === "rich-text"
    ? { ...block, document: richTextSchema.parse(block.document) }
    : block;
}

export const contentPages: readonly ContentPage[] = [historia, patron].map((page) => ({
  ...page,
  sections: page.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map(validated),
  })),
}));
