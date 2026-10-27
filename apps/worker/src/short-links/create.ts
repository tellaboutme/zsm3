import { newShortLinkSchema } from "@zsm3/contracts/short-links";

import { expiryFrom, generateCode } from "../domain/short-link.ts";
import { hashPassword, type PasswordDigest } from "../security/passwords.ts";
import type { RandomBytes } from "../storage/ids.ts";
import type { ShortLinksRepo } from "../storage/short-links-repo.ts";

export const CODE_ATTEMPTS = 5;

export interface CreateDeps {
  readonly links: ShortLinksRepo;
  readonly random: RandomBytes;
  readonly passwordKey: string | undefined;
}

export interface CreateInput {
  readonly body: unknown;
  readonly createdBy: string;
  readonly now: Date;
}

export type CreateOutcome =
  | { readonly kind: "created"; readonly code: string }
  | { readonly kind: "invalid" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "exhausted" };

type DigestOutcome =
  | { readonly kind: "ready"; readonly digest: PasswordDigest | null }
  | { readonly kind: "unavailable" };

async function digestFor(deps: CreateDeps, password: string | undefined): Promise<DigestOutcome> {
  if (password === undefined) {
    return { kind: "ready", digest: null };
  }
  const key = deps.passwordKey;
  return key === undefined
    ? { kind: "unavailable" }
    : { kind: "ready", digest: await hashPassword(key, password, deps.random) };
}

async function freeCode(deps: CreateDeps): Promise<string | undefined> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = generateCode(deps.random);
    if ((await deps.links.find(code)) === undefined) {
      return code;
    }
  }
  return undefined;
}

export async function createShortLink(
  deps: CreateDeps,
  input: CreateInput,
): Promise<CreateOutcome> {
  const parsed = newShortLinkSchema.safeParse(input.body);
  if (!parsed.success) {
    return { kind: "invalid" };
  }
  const password = await digestFor(deps, parsed.data.password);
  if (password.kind === "unavailable") {
    return { kind: "unavailable" };
  }
  const code = await freeCode(deps);
  if (code === undefined) {
    return { kind: "exhausted" };
  }
  await deps.links.create({
    code,
    target: parsed.data.target,
    password: password.digest,
    createdBy: input.createdBy,
    expiresAt: expiryFrom(input.now, parsed.data.lifetimeDays),
  });
  return { kind: "created", code };
}
