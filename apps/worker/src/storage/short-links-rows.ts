import {
  linkFileFormatSchema,
  linkFileNameSchema,
  MAX_LINK_FILE_BYTES,
  shortCodeSchema,
  targetUrlSchema,
  type LinkFile,
} from "@zsm3/contracts/short-links";
import { z } from "zod";

import { bytesSchema } from "./requests-rows.ts";
import type { LinkWindow } from "../domain/short-link.ts";
import type { PasswordDigest } from "../security/passwords.ts";

export const linkObjectKeySchema = z
  .string()
  .regex(/^s\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);

export interface StoredLinkFile extends LinkFile {
  readonly objectKey: string;
}

export type LinkDestination =
  | { readonly kind: "url"; readonly target: string }
  | { readonly kind: "file"; readonly file: StoredLinkFile };

export interface ShortLinkRecord extends LinkWindow {
  readonly code: string;
  readonly destination: LinkDestination;
  readonly password: PasswordDigest | null;
}

export interface AuthorShortLinkRecord extends LinkWindow {
  readonly code: string;
  readonly target: string | null;
  readonly file: LinkFile | null;
  readonly createdAt: string;
  readonly clicks: number;
  readonly passwordProtected: boolean;
}

const fileBytesSchema = z.int().min(1).max(MAX_LINK_FILE_BYTES);

const linkBaseSchema = z.strictObject({
  code: shortCodeSchema,
  password_salt: bytesSchema.nullable(),
  password_hash: bytesSchema.nullable(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
});

export const linkRowSchema = z.union([
  linkBaseSchema.extend({
    target_url: targetUrlSchema,
    object_key: z.null(),
    file_name: z.null(),
    file_format: z.null(),
    file_bytes: z.null(),
  }),
  linkBaseSchema.extend({
    target_url: z.literal(""),
    object_key: linkObjectKeySchema,
    file_name: linkFileNameSchema,
    file_format: linkFileFormatSchema,
    file_bytes: fileBytesSchema,
  }),
]);

const authorBaseSchema = z.strictObject({
  code: shortCodeSchema,
  created_at: z.string(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
  clicks: z.number().int().nonnegative(),
  password_protected: z.union([z.literal(0), z.literal(1)]),
});

export const authorLinkRowSchema = z.union([
  authorBaseSchema.extend({
    target_url: targetUrlSchema,
    file_name: z.null(),
    file_format: z.null(),
    file_bytes: z.null(),
  }),
  authorBaseSchema.extend({
    target_url: z.literal(""),
    file_name: linkFileNameSchema,
    file_format: linkFileFormatSchema,
    file_bytes: fileBytesSchema,
  }),
]);

export type LinkRow = z.infer<typeof linkRowSchema>;
export type AuthorLinkRow = z.infer<typeof authorLinkRowSchema>;

function destinationOf(row: LinkRow): LinkDestination {
  if (row.object_key === null) {
    return { kind: "url", target: row.target_url };
  }
  return {
    kind: "file",
    file: {
      objectKey: row.object_key,
      name: row.file_name,
      format: row.file_format,
      bytes: row.file_bytes,
    },
  };
}

export function toRecord(row: LinkRow): ShortLinkRecord {
  const { password_salt: salt, password_hash: hash } = row;
  const password = salt === null || hash === null ? null : { salt, hash };
  return {
    code: row.code,
    destination: destinationOf(row),
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    password,
  };
}

export function toAuthorRecord(row: AuthorLinkRow): AuthorShortLinkRecord {
  const file =
    row.file_name === null
      ? null
      : { name: row.file_name, format: row.file_format, bytes: row.file_bytes };
  return {
    code: row.code,
    target: file === null ? row.target_url : null,
    file,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    clicks: row.clicks,
    passwordProtected: row.password_protected === 1,
  };
}
