import { hmacSha256 } from "./hmac.ts";
import { encodeBase64url } from "./tokens.ts";
import type { RandomBytes } from "../storage/ids.ts";

export const PASSWORD_SALT_BYTES = 16;

export interface PasswordDigest {
  readonly salt: Uint8Array;
  readonly hash: Uint8Array;
}

export async function derivePassword(
  key: string,
  salt: Uint8Array,
  password: string,
): Promise<Uint8Array> {
  return hmacSha256(key, `${encodeBase64url(salt)}:${password}`);
}

export async function hashPassword(
  key: string,
  password: string,
  random: RandomBytes,
): Promise<PasswordDigest> {
  const salt = random(PASSWORD_SALT_BYTES);
  return { salt, hash: await derivePassword(key, salt, password) };
}

export function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export async function verifyPassword(
  key: string,
  password: string,
  digest: PasswordDigest,
): Promise<boolean> {
  return equalBytes(await derivePassword(key, digest.salt, password), digest.hash);
}
