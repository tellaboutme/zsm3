import { CODE_ALPHABET, CODE_LENGTH } from "@zsm3/contracts/short-links";

import type { RandomBytes } from "../storage/ids.ts";

const DAY_MS = 86_400_000;

export interface LinkWindow {
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

function letterFor(byte: number): string {
  const index = byte % CODE_ALPHABET.length;
  return CODE_ALPHABET.slice(index, index + 1);
}

export function generateCode(random: RandomBytes): string {
  return [...random(CODE_LENGTH)].map(letterFor).join("");
}

export function normaliseCode(value: string): string {
  return value.trim().toLowerCase();
}

export function expiryFrom(createdAt: Date, lifetimeDays: number): string {
  return new Date(createdAt.getTime() + lifetimeDays * DAY_MS).toISOString();
}

export function hasLapsed(window: LinkWindow, now: Date): boolean {
  return window.revokedAt !== null || Date.parse(window.expiresAt) <= now.getTime();
}
