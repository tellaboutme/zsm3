import { CODE_ALPHABET, CODE_LENGTH, shortCodeSchema } from "@zsm3/contracts/short-links";
import { describe, it } from "vitest";

import { expiryFrom, generateCode, hasLapsed, normaliseCode } from "../../src/domain/short-link.ts";
import type { RandomBytes } from "../../src/storage/ids.ts";

const bytes =
  (values: readonly number[]): RandomBytes =>
  () =>
    Uint8Array.from(values);

describe("generated codes", () => {
  it("maps every byte into the alphabet without bias", ({ expect }) => {
    expect(256 % CODE_ALPHABET.length).toBe(0);
    const counts = new Map<string, number>();
    for (let byte = 0; byte < 256; byte += 1) {
      const letter = generateCode(bytes([byte]));
      counts.set(letter, (counts.get(letter) ?? 0) + 1);
    }

    expect(counts.size).toBe(CODE_ALPHABET.length);
    expect([...counts.keys()].every((letter) => CODE_ALPHABET.includes(letter))).toBe(true);
    expect([...new Set(counts.values())]).toEqual([256 / CODE_ALPHABET.length]);
  });

  it("builds a code of the agreed length from the random bytes", ({ expect }) => {
    const code = generateCode(bytes([0, 1, 2, 3, 4, 5, 6]));

    expect(code).toBe("23456789abcdefghijkmnpqrstuvwxyz".slice(0, CODE_LENGTH));
    expect(shortCodeSchema.safeParse(code).success).toBe(true);
    expect(generateCode(bytes([32, 33]))).toBe("23");
  });
});

describe("codes typed by hand", () => {
  it("ignores case and surrounding spaces", ({ expect }) => {
    expect(normaliseCode("  K7MQ4RA ")).toBe("k7mq4ra");
    expect(normaliseCode("k7mq4ra")).toBe("k7mq4ra");
  });
});

describe("expiry", () => {
  it("counts whole days from the moment the link is made", ({ expect }) => {
    expect(expiryFrom(new Date("2026-10-27T08:00:00.000Z"), 1)).toBe("2026-10-28T08:00:00.000Z");
    expect(expiryFrom(new Date("2026-10-27T08:00:00.000Z"), 365)).toBe("2027-10-27T08:00:00.000Z");
  });

  it("treats a link as lapsed once it expires or is revoked", ({ expect }) => {
    const now = new Date("2026-10-27T08:00:00.000Z");

    expect(hasLapsed({ expiresAt: "2026-10-27T08:00:01.000Z", revokedAt: null }, now)).toBe(false);
    expect(hasLapsed({ expiresAt: "2026-10-27T08:00:00.000Z", revokedAt: null }, now)).toBe(true);
    expect(hasLapsed({ expiresAt: "2026-10-26T08:00:00.000Z", revokedAt: null }, now)).toBe(true);
    expect(
      hasLapsed(
        { expiresAt: "2027-10-27T08:00:00.000Z", revokedAt: "2026-10-26T08:00:00.000Z" },
        now,
      ),
    ).toBe(true);
  });
});
