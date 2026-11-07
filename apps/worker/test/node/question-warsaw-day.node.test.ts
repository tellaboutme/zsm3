import { describe, it } from "vitest";

import { warsawDay } from "../../src/domain/question-lifecycle.ts";

describe("warsawDay", () => {
  it("counts the day in Warsaw in winter and summer", ({ expect }) => {
    expect(warsawDay(new Date("2026-11-06T22:59:59.000Z"))).toBe("2026-11-06");
    expect(warsawDay(new Date("2026-11-06T23:00:00.000Z"))).toBe("2026-11-07");
    expect(warsawDay(new Date("2026-07-06T21:59:59.000Z"))).toBe("2026-07-06");
    expect(warsawDay(new Date("2026-07-06T22:00:00.000Z"))).toBe("2026-07-07");
  });
});
