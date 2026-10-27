import { describe, it } from "vitest";

import {
  CODE_ALPHABET,
  CODE_LENGTH,
  lifetimeDaysSchema,
  linkPasswordSchema,
  MAX_LIFETIME_DAYS,
  MAX_PASSWORD_LENGTH,
  MAX_TARGET_LENGTH,
  MIN_PASSWORD_LENGTH,
  newShortLinkSchema,
  shortCodeSchema,
  targetUrlSchema,
} from "../src/short-links.ts";

describe("short codes", () => {
  it("has an alphabet without characters that are read wrongly", ({ expect }) => {
    expect(CODE_ALPHABET).not.toMatch(/[01lo]/u);
    expect(CODE_ALPHABET).toHaveLength(32);
    expect(new Set(CODE_ALPHABET).size).toBe(CODE_ALPHABET.length);
  });

  it("accepts every letter of the alphabet and refuses the ones left out", ({ expect }) => {
    for (const letter of CODE_ALPHABET) {
      expect(shortCodeSchema.safeParse(letter.repeat(CODE_LENGTH)).success).toBe(true);
    }
    for (const letter of "01lo") {
      expect(shortCodeSchema.safeParse(letter.repeat(CODE_LENGTH)).success).toBe(false);
    }
  });

  it("accepts codes of the exact length from that alphabet", ({ expect }) => {
    expect(CODE_LENGTH).toBe(7);
    expect(shortCodeSchema.safeParse("k7mq4ra").success).toBe(true);
    expect(shortCodeSchema.safeParse("k7mq4r").success).toBe(false);
    expect(shortCodeSchema.safeParse("k7mq4raa").success).toBe(false);
    expect(shortCodeSchema.safeParse("K7MQ4RA").success).toBe(false);
    expect(shortCodeSchema.safeParse("k7mq4r0").success).toBe(false);
    expect(shortCodeSchema.safeParse("k7mq4r-").success).toBe(false);
  });
});

describe("short link targets", () => {
  it("accepts only https addresses within the length limit", ({ expect }) => {
    expect(targetUrlSchema.safeParse("https://example.org/plik.pdf").success).toBe(true);
    expect(targetUrlSchema.safeParse("http://example.org").success).toBe(false);
    expect(targetUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(targetUrlSchema.safeParse("/wewnetrzny").success).toBe(false);
    expect(
      targetUrlSchema.safeParse(`https://e.org/${"a".repeat(MAX_TARGET_LENGTH)}`).success,
    ).toBe(false);
  });
});

describe("link lifetime and password", () => {
  it("allows between one day and a school year", ({ expect }) => {
    expect(MAX_LIFETIME_DAYS).toBe(365);
    expect(lifetimeDaysSchema.safeParse(1).success).toBe(true);
    expect(lifetimeDaysSchema.safeParse(MAX_LIFETIME_DAYS).success).toBe(true);
    expect(lifetimeDaysSchema.safeParse(0).success).toBe(false);
    expect(lifetimeDaysSchema.safeParse(MAX_LIFETIME_DAYS + 1).success).toBe(false);
    expect(lifetimeDaysSchema.safeParse(1.5).success).toBe(false);
  });

  it("keeps passwords long enough to be worth checking", ({ expect }) => {
    expect([MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH]).toEqual([6, 200]);
    expect(linkPasswordSchema.safeParse("klasa4".padEnd(MIN_PASSWORD_LENGTH, "x")).success).toBe(
      true,
    );
    expect(linkPasswordSchema.safeParse("krot").success).toBe(false);
    expect(linkPasswordSchema.safeParse("x".repeat(MAX_PASSWORD_LENGTH + 1)).success).toBe(false);
  });
});

describe("a new short link", () => {
  it("takes a target, a lifetime and an optional password", ({ expect }) => {
    expect(
      newShortLinkSchema.safeParse({ target: "https://example.org/a", lifetimeDays: 30 }).success,
    ).toBe(true);
    expect(
      newShortLinkSchema.safeParse({
        target: "https://example.org/a",
        lifetimeDays: 30,
        password: "tajne1",
      }).success,
    ).toBe(true);
    expect(
      newShortLinkSchema.safeParse({
        target: "https://example.org/a",
        lifetimeDays: 30,
        notes: "nie",
      }).success,
    ).toBe(false);
    expect(newShortLinkSchema.safeParse({ lifetimeDays: 30 }).success).toBe(false);
  });
});
