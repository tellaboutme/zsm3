import { describe, it } from "vitest";

import { DEFAULT_PUBLIC_ORIGIN, INDEXNOW_KEY, indexNowKeyLocation } from "../src/indexnow.ts";

describe("INDEXNOW_KEY", () => {
  it("is the 32 hex characters required by search engines", ({ expect }) => {
    expect(INDEXNOW_KEY).toMatch(/^[0-9a-f]{32}$/u);
  });
});

describe("indexNowKeyLocation", () => {
  it("serves the key file at the public root", ({ expect }) => {
    expect(indexNowKeyLocation("www.zsm3.test")).toBe(`https://www.zsm3.test/${INDEXNOW_KEY}.txt`);
  });
});

describe("DEFAULT_PUBLIC_ORIGIN", () => {
  it("matches the production site origin", ({ expect }) => {
    expect(DEFAULT_PUBLIC_ORIGIN).toBe("https://www.zespolszkolmechanicznych.edu.pl");
  });
});
