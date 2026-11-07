import type { PiiCrypto } from "../security/pii-crypto.ts";
import type { SealedText } from "../storage/questions-repo.ts";

export type SealPurpose = "question" | "draft";

function associatedData(purpose: SealPurpose, id: string): string {
  return `${purpose}:${id}`;
}

export async function seal(
  crypto: PiiCrypto,
  purpose: SealPurpose,
  id: string,
  plaintext: string,
): Promise<SealedText> {
  return crypto.encrypt(plaintext, associatedData(purpose, id));
}

export async function unseal(
  crypto: PiiCrypto,
  purpose: SealPurpose,
  id: string,
  sealed: SealedText,
): Promise<string> {
  return crypto.decrypt(sealed.ciphertext, sealed.keyId, associatedData(purpose, id));
}
