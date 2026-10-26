import { sha256 } from "./hmac.ts";
import type { RandomBytes } from "../storage/ids.ts";

const TOKEN_BYTES = 32;

export function statusToken(random: RandomBytes): string {
  return encodeBase64url(random(TOKEN_BYTES));
}

export function encodeBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function tokenHash(token: string): Promise<Uint8Array> {
  return sha256(token);
}
