const UUID_BYTES = 16;
const TIMESTAMP_BYTES = 6;
const VERSION_4 = 0x40;
const VERSION_7 = 0x70;
const VARIANT_RFC = 0x80;
const LOW_NIBBLE = 0x0f;
const LOW_SIX_BITS = 0x3f;
const TWO_TO_32 = 2 ** 32;
const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const SLUG_MASK = 0x1f;

export type RandomBytes = (length: number) => Uint8Array;

export function cryptoRandom(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function formatUuid(bytes: Uint8Array): string {
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export function uuidv7(milliseconds: number, random: RandomBytes): string {
  const bytes = new Uint8Array(UUID_BYTES);
  bytes.set(random(UUID_BYTES - TIMESTAMP_BYTES), TIMESTAMP_BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, Math.floor(milliseconds / TWO_TO_32));
  view.setUint32(2, milliseconds % TWO_TO_32);
  view.setUint8(6, VERSION_7 | (view.getUint8(6) & LOW_NIBBLE));
  view.setUint8(8, VARIANT_RFC | (view.getUint8(8) & LOW_SIX_BITS));
  return formatUuid(bytes);
}

export function uuidv4(random: RandomBytes): string {
  const bytes = new Uint8Array(random(UUID_BYTES));
  const view = new DataView(bytes.buffer);
  view.setUint8(6, VERSION_4 | (view.getUint8(6) & LOW_NIBBLE));
  view.setUint8(8, VARIANT_RFC | (view.getUint8(8) & LOW_SIX_BITS));
  return formatUuid(bytes);
}

export function publicSlug(random: RandomBytes, length: number): string {
  return [...random(length)].map((byte) => SLUG_ALPHABET.charAt(byte & SLUG_MASK)).join("");
}
