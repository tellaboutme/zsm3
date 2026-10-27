import { requestPiiSchema, type RequestPii } from "@zsm3/contracts/requests";

import type { RequestsConfig } from "../env.ts";
import type { EmailSender } from "./email-sender.ts";
import { EmailDeliveryError } from "./email-sender.ts";
import { templateFor } from "./templates.ts";
import { statusLink } from "../requests/submit.ts";
import type { PiiCrypto } from "../security/pii-crypto.ts";
import type { OutboxRepo, OutboxRow } from "../storage/outbox-repo.ts";
import type { RequestRecord, RequestsRepo } from "../storage/requests-repo.ts";

export const MAX_DRAIN = 20;

export type DrainOutcome = "sent" | "retried" | "dead" | "stale";

export interface DrainResult {
  readonly sent: number;
  readonly retried: number;
  readonly deadLettered: number;
}

export interface DrainDeps {
  readonly requests: RequestsRepo;
  readonly outbox: OutboxRepo;
  readonly crypto: PiiCrypto;
  readonly sender: EmailSender;
  readonly config: RequestsConfig;
}

export async function drainOutbox(deps: DrainDeps, now: Date, limit: number): Promise<DrainResult> {
  const rows = await deps.outbox.claim(now, limit);
  let sent = 0;
  let retried = 0;
  let deadLettered = 0;
  for (const row of rows) {
    const outcome = await processRow(deps, row);
    if (outcome === "sent") {
      sent += 1;
    } else if (outcome === "retried") {
      retried += 1;
    } else if (outcome === "dead") {
      deadLettered += 1;
    }
  }
  return { sent, retried, deadLettered };
}

async function processRow(deps: DrainDeps, row: OutboxRow): Promise<DrainOutcome> {
  const request = await deps.requests.findById(row.requestId);
  const pii = await optionalPii(deps.crypto, request);
  const recipient = row.kind === "SECRETARIAT_NOTICE" ? deps.config.secretariatEmail : pii?.email;
  if (request === undefined || recipient === undefined) {
    const errorCode = request === undefined ? "request_missing" : "recipient_unavailable";
    return deps.outbox.markFailed(row, errorCode);
  }
  const content = templateFor(row.kind, {
    requestId: request.id,
    type: request.type,
    statusLink: row.origin === null ? "" : statusLink(row.origin, pii?.statusToken),
  });
  if (!(await deps.outbox.active(row))) return "stale";
  return deliver(deps, row, recipient, content);
}

async function deliver(
  deps: DrainDeps,
  row: OutboxRow,
  recipient: string,
  content: { readonly subject: string; readonly text: string },
): Promise<DrainOutcome> {
  try {
    await deps.sender.send({
      from: deps.config.statusEmailFrom,
      to: recipient,
      subject: content.subject,
      text: content.text,
    });
  } catch (error) {
    const errorCode = error instanceof EmailDeliveryError ? error.errorCode : "unexpected_error";
    return deps.outbox.markFailed(row, errorCode);
  }
  return acknowledge(deps.outbox, row);
}

async function acknowledge(outbox: OutboxRepo, row: OutboxRow): Promise<DrainOutcome> {
  return (await outbox.markSent(row)) ? "sent" : "stale";
}

async function optionalPii(
  crypto: PiiCrypto,
  request: RequestRecord | undefined,
): Promise<RequestPii | undefined> {
  if (request === undefined || request.piiCiphertext === null || request.piiKeyId === null) {
    return undefined;
  }
  try {
    const plaintext = await crypto.decrypt(request.piiCiphertext, request.piiKeyId, request.id);
    return requestPiiSchema.parse(JSON.parse(plaintext));
  } catch {
    return undefined;
  }
}
