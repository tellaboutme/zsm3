import { shortCodeSchema } from "@zsm3/contracts/short-links";

import { hasLapsed, normaliseCode } from "../domain/short-link.ts";
import { sha256 } from "../security/hmac.ts";
import { verifyPassword } from "../security/passwords.ts";
import { RATE_LIMIT_WINDOW_MINUTES, type RateLimitsRepo } from "../storage/rate-limits-repo.ts";
import type { ShortLinkRecord, ShortLinksRepo } from "../storage/short-links-repo.ts";

export const PASSWORD_ATTEMPTS = 30;

const MINUTE_MS = 60_000;

export interface ResolveDeps {
  readonly links: ShortLinksRepo;
  readonly rateLimits: RateLimitsRepo;
  readonly passwordKey: string | undefined;
}

export type LapsedOutcome = { readonly kind: "gone" } | { readonly kind: "missing" };

export type OpenOutcome =
  | { readonly kind: "redirect"; readonly target: string }
  | { readonly kind: "locked" }
  | LapsedOutcome;

export type UnlockOutcome =
  OpenOutcome | { readonly kind: "throttled" } | { readonly kind: "unavailable" };

type FoundLink = { readonly kind: "found"; readonly link: ShortLinkRecord } | LapsedOutcome;

async function findLive(deps: ResolveDeps, code: string, now: Date): Promise<FoundLink> {
  if (!shortCodeSchema.safeParse(code).success) {
    return { kind: "missing" };
  }
  const link = await deps.links.find(code);
  if (link === undefined) {
    return { kind: "missing" };
  }
  return hasLapsed(link, now) ? { kind: "gone" } : { kind: "found", link };
}

async function attemptsExceeded(deps: ResolveDeps, code: string, now: Date): Promise<boolean> {
  const key = await sha256(`shortlink:${code}`);
  const cutoff = new Date(now.getTime() - RATE_LIMIT_WINDOW_MINUTES * MINUTE_MS);
  const state = await deps.rateLimits.consume(key, now.toISOString(), cutoff.toISOString());
  return state.count > PASSWORD_ATTEMPTS;
}

async function opened(deps: ResolveDeps, link: ShortLinkRecord): Promise<OpenOutcome> {
  await deps.links.countClick(link.code);
  return { kind: "redirect", target: link.target };
}

export async function openLink(deps: ResolveDeps, code: string, now: Date): Promise<OpenOutcome> {
  const found = await findLive(deps, normaliseCode(code), now);
  if (found.kind !== "found") {
    return found;
  }
  return found.link.password === null ? await opened(deps, found.link) : { kind: "locked" };
}

export async function unlockLink(
  deps: ResolveDeps,
  code: string,
  password: string,
  now: Date,
): Promise<UnlockOutcome> {
  const normalised = normaliseCode(code);
  const found = await findLive(deps, normalised, now);
  if (found.kind !== "found") {
    return found;
  }
  const digest = found.link.password;
  if (digest === null) {
    return await opened(deps, found.link);
  }
  if (deps.passwordKey === undefined) {
    return { kind: "unavailable" };
  }
  if (await attemptsExceeded(deps, normalised, now)) {
    return { kind: "throttled" };
  }
  if (!(await verifyPassword(deps.passwordKey, password, digest))) {
    return { kind: "locked" };
  }
  return await opened(deps, found.link);
}

export function submittedPassword(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function passwordRedirect(outcome: UnlockOutcome, path: string): string {
  switch (outcome.kind) {
    case "redirect":
      return outcome.target;
    case "locked":
      return `${path}?blad=haslo`;
    case "throttled":
      return `${path}?blad=limit`;
    case "unavailable":
      return `${path}?blad=brak`;
    case "gone":
    case "missing":
      return path;
  }
}
