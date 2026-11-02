import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { INDEXNOW_KEY } from "@zsm3/contracts/indexnow";
import { describe, it } from "vitest";

const PUBLIC_DIR = join(import.meta.dirname, "..", "public");

function keyFiles(): string[] {
  return readdirSync(PUBLIC_DIR).filter((name) => /^[0-9a-f]{32}\.txt$/u.test(name));
}

describe("the IndexNow key file", () => {
  it("ships the contract key under its own file name", ({ expect }) => {
    expect(keyFiles()).toEqual([`${INDEXNOW_KEY}.txt`]);
  });

  it("serves the bare key as the file body", ({ expect }) => {
    const body = readFileSync(join(PUBLIC_DIR, `${INDEXNOW_KEY}.txt`), "utf8");
    expect(body).toBe(INDEXNOW_KEY);
  });
});
