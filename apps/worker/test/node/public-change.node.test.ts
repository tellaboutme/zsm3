import type { PublicationStatus } from "@zsm3/contracts/content";
import { describe, it } from "vitest";

import { announcesChange } from "../../src/domain/public-change.ts";

const CASES: readonly (readonly [
  PublicationStatus | undefined,
  PublicationStatus,
  boolean,
  boolean,
])[] = [
  [undefined, "published", true, true],
  [undefined, "draft", true, false],
  ["draft", "published", false, true],
  ["draft", "published", true, true],
  ["published", "draft", false, true],
  ["published", "draft", true, true],
  ["published", "published", true, true],
  ["published", "published", false, false],
  ["draft", "draft", true, false],
  ["draft", "draft", false, false],
];

describe("announcesChange", () => {
  it.for(CASES)("%s -> %s, edited %s: %s", ([before, after, edited, expected], { expect }) => {
    expect(announcesChange({ before, after, edited })).toBe(expected);
  });
});
