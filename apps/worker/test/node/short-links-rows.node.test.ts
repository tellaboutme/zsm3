import { describe, it } from "vitest";

import {
  authorLinkRowSchema,
  linkObjectKeySchema,
  linkRowSchema,
  toAuthorRecord,
  toRecord,
} from "../../src/storage/short-links-rows.ts";

const TARGET = "https://example.org/materialy/lekcja.pdf";
const OBJECT_KEY = "s/019a0b6c-1d2e-7f30-8a41-b52c63d74e85";
const NO_FILE = { object_key: null, file_name: null, file_format: null, file_bytes: null };

const URL_ROW = {
  code: "k7mq4ra",
  target_url: TARGET,
  password_salt: null,
  password_hash: null,
  expires_at: "2027-08-31T22:00:00.000Z",
  revoked_at: null,
  ...NO_FILE,
};

const FILE_ROW = {
  ...URL_ROW,
  target_url: "",
  object_key: OBJECT_KEY,
  file_name: "karta pracy.pdf",
  file_format: "pdf",
  file_bytes: 1200,
};

describe("short link resolver rows", () => {
  it("reads a row without a password as an open link to its target", ({ expect }) => {
    expect(toRecord(linkRowSchema.parse(URL_ROW))).toEqual({
      code: "k7mq4ra",
      destination: { kind: "url", target: TARGET },
      expiresAt: "2027-08-31T22:00:00.000Z",
      revokedAt: null,
      password: null,
    });
  });

  it("keeps the salt and the digest together", ({ expect }) => {
    const record = toRecord(
      linkRowSchema.parse({
        ...URL_ROW,
        password_salt: new Uint8Array([1, 2]),
        password_hash: new Uint8Array([3, 4]),
      }),
    );

    expect(record.password).toEqual({
      salt: new Uint8Array([1, 2]),
      hash: new Uint8Array([3, 4]),
    });
  });

  it("drops a half-stored password", ({ expect }) => {
    const record = toRecord(
      linkRowSchema.parse({ ...URL_ROW, password_salt: new Uint8Array([1, 2]) }),
    );

    expect(record.password).toBeNull();
  });

  it("reads a file row as a private file with its object key", ({ expect }) => {
    expect(toRecord(linkRowSchema.parse(FILE_ROW)).destination).toEqual({
      kind: "file",
      file: { objectKey: OBJECT_KEY, name: "karta pracy.pdf", format: "pdf", bytes: 1200 },
    });
  });

  it("refuses a row that mixes a target with a file or names an unsafe key", ({ expect }) => {
    expect(linkRowSchema.safeParse({ ...FILE_ROW, target_url: TARGET }).success).toBe(false);
    expect(linkRowSchema.safeParse({ ...URL_ROW, target_url: "" }).success).toBe(false);
    expect(linkRowSchema.safeParse({ ...FILE_ROW, object_key: "d/abc.pdf" }).success).toBe(false);
    expect(linkRowSchema.safeParse({ ...FILE_ROW, file_format: "html" }).success).toBe(false);
    expect(linkRowSchema.safeParse({ ...FILE_ROW, file_bytes: 0 }).success).toBe(false);
  });
});

describe("private object keys", () => {
  it("are server-made version 7 identifiers under the private prefix", ({ expect }) => {
    expect(linkObjectKeySchema.safeParse(OBJECT_KEY).success).toBe(true);
    for (const key of [
      "d/019a0b6c-1d2e-7f30-8a41-b52c63d74e85",
      "s/019a0b6c-1d2e-4f30-8a41-b52c63d74e85",
      "s/019a0b6c-1d2e-7f30-7a41-b52c63d74e85",
      "s/../019a0b6c-1d2e-7f30-8a41-b52c63d74e85",
      `${OBJECT_KEY}x`,
      `x${OBJECT_KEY}`,
    ]) {
      expect(linkObjectKeySchema.safeParse(key).success).toBe(false);
    }
  });
});

describe("author rows", () => {
  const base = {
    code: "k7mq4ra",
    created_at: "2026-11-03T08:00:00.000Z",
    expires_at: "2027-08-31T22:00:00.000Z",
    revoked_at: null,
    clicks: 3,
    password_protected: 1,
  };

  it("lists a target link without file metadata", ({ expect }) => {
    const row = authorLinkRowSchema.parse({
      ...base,
      target_url: TARGET,
      file_name: null,
      file_format: null,
      file_bytes: null,
    });

    expect(toAuthorRecord(row)).toEqual({
      code: "k7mq4ra",
      target: TARGET,
      file: null,
      createdAt: "2026-11-03T08:00:00.000Z",
      expiresAt: "2027-08-31T22:00:00.000Z",
      revokedAt: null,
      clicks: 3,
      passwordProtected: true,
    });
  });

  it("lists a file link by name, format and size only", ({ expect }) => {
    const row = authorLinkRowSchema.parse({
      ...base,
      password_protected: 0,
      target_url: "",
      file_name: "plan.odt",
      file_format: "odt",
      file_bytes: 99,
    });

    expect(toAuthorRecord(row)).toMatchObject({
      target: null,
      file: { name: "plan.odt", format: "odt", bytes: 99 },
      passwordProtected: false,
    });
  });
});
