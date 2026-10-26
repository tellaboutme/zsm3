import { tokenEnvelopeSchema } from "./request-status.ts";
import { canTransition } from "../domain/request-lifecycle.ts";
import { tokenHash } from "../security/tokens.ts";
import { timestamp, type Store } from "../storage/database.ts";
import type { RequestsRepo } from "../storage/requests-repo.ts";

export interface WithdrawDeps {
  readonly requests: RequestsRepo;
  readonly store: Store;
}

export type WithdrawOutcome =
  { readonly kind: "withdrawn" } | { readonly kind: "missing" } | { readonly kind: "not_allowed" };

export async function withdrawRequest(deps: WithdrawDeps, body: unknown): Promise<WithdrawOutcome> {
  const parsed = tokenEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    return { kind: "missing" };
  }
  const record = await deps.requests.findByTokenHash(await tokenHash(parsed.data.token));
  if (record === undefined) {
    return { kind: "missing" };
  }
  if (record.status === "withdrawn") {
    return { kind: "withdrawn" };
  }
  if (!canTransition(record.status, "withdrawn")) {
    return { kind: "not_allowed" };
  }
  const updated = await deps.requests.withdrawAndErase(record.id, timestamp(deps.store.clock));
  return updated.status === "withdrawn" ? { kind: "withdrawn" } : { kind: "not_allowed" };
}
