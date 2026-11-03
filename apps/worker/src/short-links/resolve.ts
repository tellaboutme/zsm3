import { shortCodeSchema, type LinkFile } from "@zsm3/contracts/short-links";

import { hasLapsed, normaliseCode } from "../domain/short-link.ts";
import { sha256 } from "../security/hmac.ts";
import { verifyPassword } from "../security/passwords.ts";
import { RATE_LIMIT_WINDOW_MINUTES, type RateLimitsRepo } from "../storage/rate-limits-repo.ts";
import type { ShortLinkRecord, ShortLinksRepo } from "../storage/short-links-repo.ts";
import type { StoredLinkFile } from "../storage/short-links-rows.ts";

export const PASSWORD_ATTEMPTS = 30;
export const DAILY_FAILED_ATTEMPTS = 100;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export interface OpenDeps {
  readonly links: ShortLinksRepo;
}

export interface ResolveDeps extends OpenDeps {
  readonly rateLimits: RateLimitsRepo;
  readonly passwordKey: string | undefined;
}

export type LapsedOutcome = { readonly kind: "gone" } | { readonly kind: "missing" };

export type OpenOutcome =
  | { readonly kind: "redirect"; readonly target: string }
  | { readonly kind: "download"; readonly file: LinkFile }
  | { readonly kind: "locked" }
  | LapsedOutcome;

export type UnlockOutcome =
  | Exclude<OpenOutcome, { readonly kind: "download" }>
  | { readonly kind: "file"; readonly file: StoredLinkFile }
  | { readonly kind: "throttled" }
  | { readonly kind: "blocked" }
  | { readonly kind: "unavailable" };

type FoundLink = { readonly kind: "found"; readonly link: ShortLinkRecord } | LapsedOutcome;

async function findLive(deps: OpenDeps, code: string, now: Date): Promise<FoundLink> {
  if (!shortCodeSchema.safeParse(code).success) {
    return { kind: "missing" };
  }
  const link = await deps.links.find(code);
  if (link === undefined) {
    return { kind: "missing" };
  }
  return hasLapsed(link, now) ? { kind: "gone" } : { kind: "found", link };
}

async function guessKey(code: string): Promise<Uint8Array> {
  return sha256(`shortlink:${code}`);
}

async function failureKey(code: string): Promise<Uint8Array> {
  return sha256(`shortlink-failures:${code}`);
}

function dayBefore(now: Date): string {
  return new Date(now.getTime() - DAY_MS).toISOString();
}

async function guessesExceeded(deps: ResolveDeps, key: Uint8Array, now: Date): Promise<boolean> {
  const cutoff = new Date(now.getTime() - RATE_LIMIT_WINDOW_MINUTES * MINUTE_MS);
  const state = await deps.rateLimits.consume(key, now.toISOString(), cutoff.toISOString());
  return state.count > PASSWORD_ATTEMPTS;
}

async function delivered(deps: OpenDeps, link: ShortLinkRecord): Promise<UnlockOutcome> {
  await deps.links.countClick(link.code);
  const { destination } = link;
  return destination.kind === "url"
    ? { kind: "redirect", target: destination.target }
    : { kind: "file", file: destination.file };
}

function publicFile(file: StoredLinkFile): LinkFile {
  return { name: file.name, format: file.format, bytes: file.bytes };
}

export async function openLink(deps: OpenDeps, code: string, now: Date): Promise<OpenOutcome> {
  const found = await findLive(deps, normaliseCode(code), now);
  if (found.kind !== "found") {
    return found;
  }
  const { destination } = found.link;
  const digest = found.link.password;
  if (digest !== null) {
    return { kind: "locked" };
  }
  if (destination.kind === "file") {
    return { kind: "download", file: publicFile(destination.file) };
  }
  await deps.links.countClick(found.link.code);
  return { kind: "redirect", target: destination.target };
}

export async function unlockLink(
  deps: ResolveDeps,
  code: string,
  attempt: string | undefined,
  now: Date,
): Promise<UnlockOutcome> {
  const normalised = normaliseCode(code);
  const found = await findLive(deps, normalised, now);
  if (found.kind !== "found") {
    return found;
  }
  const digest = found.link.password;
  if (digest === null) {
    return await delivered(deps, found.link);
  }
  if (attempt === undefined) {
    return { kind: "locked" };
  }
  if (deps.passwordKey === undefined) {
    return { kind: "unavailable" };
  }
  const failures = await failureKey(normalised);
  if ((await deps.rateLimits.peek(failures, dayBefore(now))) >= DAILY_FAILED_ATTEMPTS) {
    return { kind: "blocked" };
  }
  const key = await guessKey(normalised);
  if (await guessesExceeded(deps, key, now)) {
    return { kind: "throttled" };
  }
  if (!(await verifyPassword(deps.passwordKey, attempt, digest))) {
    await deps.rateLimits.consume(failures, now.toISOString(), dayBefore(now));
    return { kind: "locked" };
  }
  await deps.rateLimits.clear(key);
  return await delivered(deps, found.link);
}

export function submittedPassword(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function passwordRedirect(
  outcome: Exclude<UnlockOutcome, { readonly kind: "file" }>,
  path: string,
): string {
  switch (outcome.kind) {
    case "redirect":
      return outcome.target;
    case "locked":
      return `${path}?blad=haslo`;
    case "throttled":
      return `${path}?blad=limit`;
    case "blocked":
      return `${path}?blad=doba`;
    case "unavailable":
      return `${path}?blad=brak`;
    case "gone":
    case "missing":
      return path;
  }
}
