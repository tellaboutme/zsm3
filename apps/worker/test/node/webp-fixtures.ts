export interface ChunkSpec {
  readonly id: string;
  readonly payload: Uint8Array;
}

function uint32(value: number): readonly number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, value >>> 24];
}

function ascii(text: string): readonly number[] {
  return [...new TextEncoder().encode(text)];
}

function chunkBytes({ id, payload }: ChunkSpec): readonly number[] {
  const pad = payload.length % 2 === 0 ? [] : [0];
  return [...ascii(id), ...uint32(payload.length), ...payload, ...pad];
}

export function riff(chunks: readonly ChunkSpec[]): Uint8Array {
  const body = [...ascii("WEBP"), ...chunks.flatMap(chunkBytes)];
  return Uint8Array.from([...ascii("RIFF"), ...uint32(body.length), ...body]);
}

export function vp8Payload(
  width: number,
  height: number,
  filler: readonly number[] = [],
): Uint8Array {
  const dimensions = [width & 0xff, width >>> 8, height & 0xff, height >>> 8];
  return Uint8Array.from([0x10, 0x00, 0x00, 0x9d, 0x01, 0x2a, ...dimensions, ...filler]);
}

export function vp8lPayload(width: number, height: number): Uint8Array {
  const bits = ((width - 1) | ((height - 1) << 14)) >>> 0;
  return Uint8Array.from([0x2f, ...uint32(bits)]);
}

export function vp8xPayload(width: number, height: number, flags = 0): Uint8Array {
  const w = width - 1;
  const h = height - 1;
  return Uint8Array.from([
    flags,
    0,
    0,
    0,
    w & 0xff,
    (w >>> 8) & 0xff,
    w >>> 16,
    h & 0xff,
    (h >>> 8) & 0xff,
    h >>> 16,
  ]);
}

export function vp8Webp(width: number, height: number, filler: readonly number[] = []): Uint8Array {
  return riff([{ id: "VP8 ", payload: vp8Payload(width, height, filler) }]);
}

export function chunk(id: string, payload: Uint8Array = new Uint8Array(4)): ChunkSpec {
  return { id, payload };
}

export function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (letter) => letter.codePointAt(0) ?? 0);
}
