import { describe, it } from "vitest";

import {
  CODE_ALPHABET,
  CODE_LENGTH,
  linkFileContentTypes,
  linkFileFormats,
  linkFileFormatSchema,
  linkFileNameSchema,
  linkFileSchema,
  linkPasswordSchema,
  MAX_LINK_FILE_BYTES,
  MAX_LINK_FILE_NAME_LENGTH,
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

describe("link password", () => {
  it("keeps passwords long enough to be worth checking", ({ expect }) => {
    expect([MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH]).toEqual([12, 200]);
    expect(linkPasswordSchema.safeParse("klasa4".padEnd(MIN_PASSWORD_LENGTH, "x")).success).toBe(
      true,
    );
    expect(
      linkPasswordSchema.safeParse("klasa4".padEnd(MIN_PASSWORD_LENGTH - 1, "x")).success,
    ).toBe(false);
    expect(linkPasswordSchema.safeParse("123456").success).toBe(false);
    expect(linkPasswordSchema.safeParse("x".repeat(MAX_PASSWORD_LENGTH + 1)).success).toBe(false);
  });
});

describe("a new short link", () => {
  it("takes a target and an optional password, and no lifetime", ({ expect }) => {
    expect(newShortLinkSchema.safeParse({ target: "https://example.org/a" }).success).toBe(true);
    expect(
      newShortLinkSchema.safeParse({ target: "https://example.org/a", password: "tajne-haslo-1" })
        .success,
    ).toBe(true);
    expect(
      newShortLinkSchema.safeParse({ target: "https://example.org/a", password: "tajne1" }).success,
    ).toBe(false);
    expect(
      newShortLinkSchema.safeParse({ target: "https://example.org/a", lifetimeDays: 30 }).success,
    ).toBe(false);
    expect(
      newShortLinkSchema.safeParse({ target: "https://example.org/a", notes: "nie" }).success,
    ).toBe(false);
    expect(newShortLinkSchema.safeParse({ password: "tajne1" }).success).toBe(false);
  });
});

describe("files behind short links", () => {
  it("accepts teaching documents only, with their exact media types", ({ expect }) => {
    expect(linkFileFormats).toEqual(["pdf", "docx", "xlsx", "pptx", "odt", "ods", "odp"]);
    expect(linkFileContentTypes).toEqual({
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      odt: "application/vnd.oasis.opendocument.text",
      ods: "application/vnd.oasis.opendocument.spreadsheet",
      odp: "application/vnd.oasis.opendocument.presentation",
    });
    for (const format of ["zip", "html", "svg", "js", "exe", "docm"]) {
      expect(linkFileFormatSchema.safeParse(format).success).toBe(false);
    }
  });

  it("bounds the size and the name of a file", ({ expect }) => {
    expect(MAX_LINK_FILE_BYTES).toBe(20 * 1024 * 1024);
    expect(MAX_LINK_FILE_NAME_LENGTH).toBe(160);
    expect(linkFileNameSchema.safeParse("").success).toBe(false);
    expect(linkFileNameSchema.safeParse("a".repeat(MAX_LINK_FILE_NAME_LENGTH)).success).toBe(true);
    expect(linkFileNameSchema.safeParse("a".repeat(MAX_LINK_FILE_NAME_LENGTH + 1)).success).toBe(
      false,
    );
    const file = { name: "karta.pdf", format: "pdf", bytes: 1 };
    expect(linkFileSchema.safeParse(file).success).toBe(true);
    expect(linkFileSchema.safeParse({ ...file, bytes: 0 }).success).toBe(false);
    expect(linkFileSchema.safeParse({ ...file, bytes: MAX_LINK_FILE_BYTES }).success).toBe(true);
    expect(linkFileSchema.safeParse({ ...file, bytes: MAX_LINK_FILE_BYTES + 1 }).success).toBe(
      false,
    );
    expect(linkFileSchema.safeParse({ ...file, key: "s/x" }).success).toBe(false);
  });
});
