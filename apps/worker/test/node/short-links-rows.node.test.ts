import { describe, it } from "vitest";

import { toRecord } from "../../src/storage/short-links-repo.ts";

const TARGET = "https://example.org/materialy/lekcja.pdf";

describe("short link resolver rows", () => {
  it("reads a row without a password as an open link", ({ expect }) => {
    expect(
      toRecord({
        code: "k7mq4ra",
        target_url: TARGET,
        password_salt: null,
        password_hash: null,
        expires_at: "2027-10-27T08:00:00.000Z",
        revoked_at: null,
      }),
    ).toEqual({
      code: "k7mq4ra",
      target: TARGET,
      expiresAt: "2027-10-27T08:00:00.000Z",
      revokedAt: null,
      password: null,
    });
  });

  it("keeps the salt and the digest together", ({ expect }) => {
    const record = toRecord({
      code: "k7mq4ra",
      target_url: TARGET,
      password_salt: new Uint8Array([1, 2]),
      password_hash: new Uint8Array([3, 4]),
      expires_at: "2027-10-27T08:00:00.000Z",
      revoked_at: null,
    });

    expect(record.password).toEqual({
      salt: new Uint8Array([1, 2]),
      hash: new Uint8Array([3, 4]),
    });
  });
});
