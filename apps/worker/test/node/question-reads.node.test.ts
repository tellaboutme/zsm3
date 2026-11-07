import { describe, it } from "vitest";

import { openSealed } from "../../src/routes/panel/question-reads.ts";
import type { PiiCrypto } from "../../src/security/pii-crypto.ts";

const SEALED = { ciphertext: new Uint8Array([1, 2, 3]), keyId: "PRIMARY" };

function failingCrypto(error: Error): PiiCrypto {
  return {
    encrypt: async () => Promise.reject(error),
    decrypt: async () => Promise.reject(error),
  };
}

describe("opening a sealed question part", () => {
  it("passes through nothing when nothing is stored", async ({ expect }) => {
    const opened = await openSealed(failingCrypto(new Error("x")), "draft", "id", null);

    expect(opened).toEqual({ readable: true, value: null });
  });

  it("does not hide failures other than decryption", async ({ expect }) => {
    const failure = new TypeError("broken");

    await expect(openSealed(failingCrypto(failure), "question", "id", SEALED)).rejects.toBe(
      failure,
    );
  });
});
