import { MissingSecretError } from "../env.ts";
import { sha256 } from "./hmac.ts";
import type { RandomBytes } from "../storage/ids.ts";

const IV_BYTES = 12;
const KEY_BYTES = 32;
const TAG_LENGTH = 128;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class PiiDecryptionError extends Error {
  readonly keyId: string;

  constructor(keyId: string, cause?: unknown) {
    super(`Cannot decrypt the personal data with the key ${keyId}`, { cause });
    this.name = "PiiDecryptionError";
    this.keyId = keyId;
  }
}

export interface EncryptedPii {
  readonly ciphertext: Uint8Array;
  readonly keyId: string;
}

export interface PiiCrypto {
  encrypt(plaintext: string, requestId: string): Promise<EncryptedPii>;
  decrypt(ciphertext: Uint8Array, keyId: string, requestId: string): Promise<string>;
}

export function piiCrypto(
  keys: Readonly<Record<string, string>>,
  activeKeyId: string,
  random: RandomBytes,
): PiiCrypto {
  return {
    encrypt: async (plaintext, requestId) => {
      const secret = keyMaterial(keys, activeKeyId);
      const iv = random(IV_BYTES);
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: encoder.encode(requestId), tagLength: TAG_LENGTH },
        await aesKey(secret),
        encoder.encode(plaintext),
      );
      return { ciphertext: join(iv, new Uint8Array(encrypted)), keyId: activeKeyId };
    },
    decrypt: async (ciphertext, keyId, requestId) => {
      const secret = keys[keyId];
      if (secret === undefined || secret.length === 0) {
        throw new PiiDecryptionError(keyId);
      }
      try {
        const decrypted = await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: ciphertext.slice(0, IV_BYTES),
            additionalData: encoder.encode(requestId),
            tagLength: TAG_LENGTH,
          },
          await aesKey(secret),
          ciphertext.slice(IV_BYTES),
        );
        return decoder.decode(decrypted);
      } catch (error) {
        throw new PiiDecryptionError(keyId, error);
      }
    },
  };
}

export async function emailIndex(indexKey: string, normalisedEmail: string): Promise<Uint8Array> {
  const digest = await sha256(indexKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    digest,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(normalisedEmail)),
  );
}

function keyMaterial(keys: Readonly<Record<string, string>>, keyId: string): string {
  const secret = keys[keyId];
  if (secret === undefined || secret.length < KEY_BYTES) {
    throw new MissingSecretError(`PII_KEY_${keyId}`);
  }
  return secret;
}

async function aesKey(secret: string) {
  const digest = await sha256(secret);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function join(iv: Uint8Array, encrypted: Uint8Array): Uint8Array {
  const combined = new Uint8Array(iv.length + encrypted.length);
  combined.set(iv);
  combined.set(encrypted, iv.length);
  return combined;
}
