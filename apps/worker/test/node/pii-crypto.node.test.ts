import fc from "fast-check";
import { describe, it } from "vitest";

import { MissingSecretError } from "../../src/env.ts";
import { emailIndex, piiCrypto } from "../../src/security/pii-crypto.ts";
import { encodeBase64url, statusToken, tokenHash } from "../../src/security/tokens.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";

const KEYS = {
  PRIMARY: "primary-key-0123456789-0123456789-0123456789",
  SECONDARY: "secondary-key-0123456789-0123456789",
};
const pii = piiCrypto(KEYS, "PRIMARY", cryptoRandom);

describe("piiCrypto", () => {
  it("round-trips arbitrary plaintexts for a fixed request id", async ({ expect }) => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (plaintext) => {
        const encrypted = await pii.encrypt(plaintext, "request-1");
        expect(encrypted.keyId).toBe("PRIMARY");
        expect(encrypted.ciphertext.length).toBeGreaterThan(12);
        expect(await pii.decrypt(encrypted.ciphertext, "PRIMARY", "request-1")).toBe(plaintext);
      }),
    );
  });

  it("binds the ciphertext to the request id", async ({ expect }) => {
    const encrypted = await pii.encrypt("Dane osobowe", "request-1");
    await expect(pii.decrypt(encrypted.ciphertext, "PRIMARY", "request-2")).rejects.toThrow(
      "Cannot decrypt the personal data with the key PRIMARY",
    );
  });

  it("rejects a foreign or corrupted ciphertext", async ({ expect }) => {
    const encrypted = await pii.encrypt("Dane osobowe", "request-1");
    await expect(pii.decrypt(encrypted.ciphertext, "SECONDARY", "request-1")).rejects.toThrow(
      "Cannot decrypt the personal data with the key SECONDARY",
    );
    const corrupted = encrypted.ciphertext.slice();
    corrupted[corrupted.length - 1] = (corrupted.at(-1) ?? 0) ^ 0xff;
    await expect(pii.decrypt(corrupted, "PRIMARY", "request-1")).rejects.toThrow();
  });

  it("refuses an unknown key id on decryption", async ({ expect }) => {
    const encrypted = await pii.encrypt("Dane osobowe", "request-1");
    await expect(pii.decrypt(encrypted.ciphertext, "MISSING", "request-1")).rejects.toThrow(
      "Cannot decrypt the personal data with the key MISSING",
    );
  });

  it("refuses an unknown or short key on encryption", async ({ expect }) => {
    const shortKeys = piiCrypto({ PRIMARY: "short" }, "PRIMARY", cryptoRandom);
    await expect(shortKeys.encrypt("Dane osobowe", "request-1")).rejects.toThrow(
      "Missing or invalid configuration value: PII_KEY_PRIMARY",
    );
    const missingKeys = piiCrypto({}, "PRIMARY", cryptoRandom);
    await expect(missingKeys.encrypt("Dane osobowe", "request-1")).rejects.toThrow(
      MissingSecretError,
    );
  });
});

describe("emailIndex", () => {
  it("derives a stable keyed index", async ({ expect }) => {
    const index = await emailIndex("index-key-0123456789-0123456789", "jan@example.com");
    expect(index).toHaveLength(32);
    expect(await emailIndex("index-key-0123456789-0123456789", "jan@example.com")).toEqual(index);
    expect(await emailIndex("index-key-0123456789-0123456789", "anna@example.com")).not.toEqual(
      index,
    );
    expect(await emailIndex("other-key-0123456789-01234567890", "jan@example.com")).not.toEqual(
      index,
    );
  });
});

describe("status tokens", () => {
  it("draws 43 character base64url tokens", ({ expect }) => {
    const token = statusToken(cryptoRandom);
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[\w-]{43}$/u);
    expect(statusToken(() => new Uint8Array(32).fill(0xff))).toBe(
      "__________________________________________8",
    );
  });

  it("encodes bytes without padding and hashes tokens", async ({ expect }) => {
    expect(encodeBase64url(new Uint8Array([0xfb, 0xff]))).toBe("-_8");
    const token = statusToken(cryptoRandom);
    expect(await tokenHash(token)).toHaveLength(32);
  });
});
