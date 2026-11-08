import { describe, it } from "vitest";

import { latestOnly } from "../src/lib/panel/latest.ts";

describe("latest request only", () => {
  it("keeps a ticket current until a newer one is issued", ({ expect }) => {
    const next = latestOnly();
    const first = next();
    expect(first()).toBe(true);
    const second = next();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it("counts each sequence on its own", ({ expect }) => {
    const albums = latestOnly();
    const lists = latestOnly();
    const album = albums();
    lists();
    lists();
    expect(album()).toBe(true);
  });
});
