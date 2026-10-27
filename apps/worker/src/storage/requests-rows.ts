import {
  requestStatusSchema,
  requestTypeSchema,
  type RequestStatus,
  type RequestType,
} from "@zsm3/contracts/requests";
import { z } from "zod";

export const bytesSchema = z
  .union([z.instanceof(Uint8Array), z.instanceof(ArrayBuffer), z.array(z.number())])
  .transform((value) => {
    if (value instanceof Uint8Array) {
      return value;
    }
    return value instanceof ArrayBuffer ? new Uint8Array(value) : Uint8Array.from(value);
  });

export interface RequestRecord {
  readonly id: string;
  readonly type: RequestType;
  readonly status: RequestStatus;
  readonly piiCiphertext: Uint8Array | null;
  readonly piiKeyId: string | null;
  readonly emailIndex: Uint8Array | null;
  readonly piiErasedAt: string | null;
  readonly statusTokenHash: Uint8Array;
  readonly formKey: string;
  readonly staffNote: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closedAt: string | null;
}

export interface CreateRequestData {
  readonly id: string;
  readonly type: RequestType;
  readonly piiCiphertext: Uint8Array;
  readonly piiKeyId: string;
  readonly emailIndex: Uint8Array;
  readonly statusTokenHash: Uint8Array;
  readonly formKey: string;
}

export type CreateRequestOutcome =
  | { readonly kind: "created"; readonly record: RequestRecord }
  | { readonly kind: "duplicate"; readonly record: RequestRecord };

export interface RequestListFilter {
  readonly status?: RequestStatus;
  readonly before?: string;
  readonly limit: number;
}

export const requestRowSchema = z.strictObject({
  id: z.string(),
  type: requestTypeSchema,
  status: requestStatusSchema,
  pii_ciphertext: bytesSchema.nullable(),
  pii_key_id: z.string().nullable(),
  email_index: bytesSchema.nullable(),
  pii_erased_at: z.string().nullable(),
  status_token_hash: bytesSchema,
  form_key: z.string(),
  staff_note: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
});

export type RequestRow = z.infer<typeof requestRowSchema>;

export function toRecord(row: RequestRow): RequestRecord {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    piiCiphertext: row.pii_ciphertext,
    piiKeyId: row.pii_key_id,
    emailIndex: row.email_index,
    piiErasedAt: row.pii_erased_at,
    statusTokenHash: row.status_token_hash,
    formKey: row.form_key,
    staffNote: row.staff_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}
