import { tokenSchema, type StatusResponse } from "@zsm3/contracts/requests";
import { z } from "zod";

import { collectionMessage } from "../domain/request-types.ts";
import { tokenHash } from "../security/tokens.ts";
import type { RequestsRepo } from "../storage/requests-repo.ts";

export const tokenEnvelopeSchema = z.strictObject({ token: tokenSchema });

export interface StatusDeps {
  readonly requests: RequestsRepo;
}

export type StatusOutcome =
  { readonly kind: "found"; readonly response: StatusResponse } | { readonly kind: "missing" };

export async function requestStatus(deps: StatusDeps, body: unknown): Promise<StatusOutcome> {
  const parsed = tokenEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    return { kind: "missing" };
  }
  const record = await deps.requests.findByTokenHash(await tokenHash(parsed.data.token));
  if (record === undefined) {
    return { kind: "missing" };
  }
  return {
    kind: "found",
    response: {
      type: record.type,
      status: record.status,
      updatedAt: record.updatedAt,
      collectionMessage: collectionMessage(record.status),
    },
  };
}
