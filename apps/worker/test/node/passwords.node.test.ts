import { describe, it } from "vitest";

import {
  derivePassword,
  equalBytes,
  hashPassword,
  PASSWORD_SALT_BYTES,
  verifyPassword,
} from "../../src/security/passwords.ts";
import type { RandomBytes } from "../../src/storage/ids.ts";

const KEY = "short-link-pepper-0123456789-0123456789";
const fixedRandom: RandomBytes = (length) => new Uint8Array(length).fill(7);

describe("byte comparison", () => {
  it("compares content and length without leaving early", ({ expect }) => {
    expect(equalBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(equalBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(equalBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
    expect(equalBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
    expect(equalBytes(new Uint8Array(), new Uint8Array())).toBe(true);
  });
});

describe("password digests", () => {
  it("salts every password and never stores it", async ({ expect }) => {
    const digest = await hashPassword(KEY, "klasa4tp", fixedRandom);

    expect(digest.salt).toHaveLength(PASSWORD_SALT_BYTES);
    expect(digest.hash).toHaveLength(32);
    expect(new TextDecoder().decode(digest.hash)).not.toContain("klasa4tp");
  });

  it("gives different digests for the same password under different salts", async ({ expect }) => {
    let counter = 0;
    const random: RandomBytes = (length) => new Uint8Array(length).fill(counter++);
    const first = await hashPassword(KEY, "klasa4tp", random);
    const second = await hashPassword(KEY, "klasa4tp", random);

    expect(equalBytes(first.hash, second.hash)).toBe(false);
  });

  it("accepts the right password and refuses anything else", async ({ expect }) => {
    const digest = await hashPassword(KEY, "klasa4tp", fixedRandom);

    await expect(verifyPassword(KEY, "klasa4tp", digest)).resolves.toBe(true);
    await expect(verifyPassword(KEY, "klasa4tq", digest)).resolves.toBe(false);
    await expect(verifyPassword(KEY, "", digest)).resolves.toBe(false);
  });

  it("refuses the right password under a different server key", async ({ expect }) => {
    const digest = await hashPassword(KEY, "klasa4tp", fixedRandom);

    await expect(verifyPassword(`${KEY}x`, "klasa4tp", digest)).resolves.toBe(false);
  });

  it("binds the digest to the salt", async ({ expect }) => {
    const salt = fixedRandom(PASSWORD_SALT_BYTES);
    const other = new Uint8Array(PASSWORD_SALT_BYTES).fill(9);

    expect(
      equalBytes(
        await derivePassword(KEY, salt, "klasa4tp"),
        await derivePassword(KEY, other, "klasa4tp"),
      ),
    ).toBe(false);
  });
});
