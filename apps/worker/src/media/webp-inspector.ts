export type WebpRejection =
  | "not-webp"
  | "size-mismatch"
  | "truncated"
  | "bad-padding"
  | "forbidden-chunk"
  | "bad-structure"
  | "bad-header"
  | "dimension-mismatch";

export type WebpInspection =
  | { readonly ok: true; readonly width: number; readonly height: number }
  | { readonly ok: false; readonly reason: WebpRejection };

interface Chunk {
  readonly id: string;
  readonly payload: Uint8Array;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

const RIFF_HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;
const VP8_HEADER_BYTES = 10;
const VP8L_HEADER_BYTES = 5;
const VP8X_PAYLOAD_BYTES = 10;
const VP8L_SIGNATURE = 0x2f;
const VP8X_ALPHA_FLAG = 0x10;
const DIMENSION_MASK = 0x3fff;
const MAX_VP8_DIMENSION = DIMENSION_MASK;
const VP8L_HEIGHT_SHIFT = 14;
const VP8L_VERSION_SHIFT = 29;
const VP8_PARTITION_SHIFT = 5;
const ALLOWED_CHUNKS: ReadonlySet<string> = new Set(["VP8 ", "VP8L", "VP8X", "ALPH"]);
const ALLOWED_LAYOUTS: ReadonlySet<string> = new Set([
  "VP8 ",
  "VP8L",
  "VP8X,VP8 ",
  "VP8X,VP8L",
  "VP8X,ALPH,VP8 ",
]);

function rejected(reason: WebpRejection): WebpInspection {
  return { ok: false, reason };
}

function fourcc(bytes: Uint8Array, offset: number): string {
  return String.fromCodePoint(...bytes.subarray(offset, offset + 4));
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function readChunks(bytes: Uint8Array): readonly Chunk[] | WebpRejection {
  const chunks: Chunk[] = [];
  const data = view(bytes);
  let offset = RIFF_HEADER_BYTES;
  while (offset < bytes.length) {
    if (offset + CHUNK_HEADER_BYTES > bytes.length) {
      return "truncated";
    }
    const id = fourcc(bytes, offset);
    if (!ALLOWED_CHUNKS.has(id)) {
      return "forbidden-chunk";
    }
    const size = data.getUint32(offset + 4, true);
    const end = offset + CHUNK_HEADER_BYTES + size;
    const next = end + (size % 2);
    if (next > bytes.length) {
      return "truncated";
    }
    if (next !== end && bytes[end] !== 0) {
      return "bad-padding";
    }
    chunks.push({ id, payload: bytes.subarray(offset + CHUNK_HEADER_BYTES, end) });
    offset = next;
  }
  return chunks;
}

function vp8Size(payload: Uint8Array): Size | undefined {
  if (payload.length < VP8_HEADER_BYTES) {
    return undefined;
  }
  const data = view(payload);
  const tag = data.getUint16(0, true) + data.getUint8(2) * 0x1_00_00;
  const keyFrame = tag % 2 === 0;
  const startCode = data.getUint16(3, true) === 0x01_9d && data.getUint8(5) === 0x2a;
  const partitionFits =
    Math.floor(tag / 2 ** VP8_PARTITION_SHIFT) <= payload.length - VP8_HEADER_BYTES;
  const width = data.getUint16(6, true);
  const height = data.getUint16(8, true);
  const dimensionsFit =
    width >= 1 && height >= 1 && width <= MAX_VP8_DIMENSION && height <= MAX_VP8_DIMENSION;
  return keyFrame && startCode && partitionFits && dimensionsFit ? { width, height } : undefined;
}

function vp8lSize(payload: Uint8Array): Size | undefined {
  if (payload.length < VP8L_HEADER_BYTES || payload[0] !== VP8L_SIGNATURE) {
    return undefined;
  }
  const bits = view(payload).getUint32(1, true);
  if (bits >>> VP8L_VERSION_SHIFT !== 0) {
    return undefined;
  }
  return {
    width: (bits & DIMENSION_MASK) + 1,
    height: ((bits >>> VP8L_HEIGHT_SHIFT) & DIMENSION_MASK) + 1,
  };
}

function imageSize(chunk: Chunk): Size | undefined {
  return chunk.id === "VP8L" ? vp8lSize(chunk.payload) : vp8Size(chunk.payload);
}

function canvasSize(payload: Uint8Array, hasAlphaChunk: boolean): Size | undefined {
  if (payload.length !== VP8X_PAYLOAD_BYTES) {
    return undefined;
  }
  const flags = payload[0];
  const reservedClear = payload[1] === 0 && payload[2] === 0 && payload[3] === 0;
  const flagsAllowed = flags === 0 || flags === VP8X_ALPHA_FLAG;
  if (!reservedClear || !flagsAllowed || (hasAlphaChunk && flags !== VP8X_ALPHA_FLAG)) {
    return undefined;
  }
  const data = view(payload);
  return {
    width: data.getUint16(4, true) + data.getUint8(6) * 0x1_00_00 + 1,
    height: data.getUint16(7, true) + data.getUint8(9) * 0x1_00_00 + 1,
  };
}

function inspectLayout(chunks: readonly Chunk[]): WebpInspection {
  const image = chunks.at(-1);
  if (image === undefined || !ALLOWED_LAYOUTS.has(chunks.map((chunk) => chunk.id).join(","))) {
    return rejected("bad-structure");
  }
  const size = imageSize(image);
  if (size === undefined) {
    return rejected("bad-header");
  }
  const first = chunks[0];
  if (first?.id !== "VP8X") {
    return { ok: true, ...size };
  }
  const canvas = canvasSize(first.payload, chunks.length === 3);
  if (canvas === undefined) {
    return rejected("bad-header");
  }
  return canvas.width === size.width && canvas.height === size.height
    ? { ok: true, ...size }
    : rejected("dimension-mismatch");
}

export function inspectWebp(bytes: Uint8Array): WebpInspection {
  if (fourcc(bytes, 0) !== "RIFF" || fourcc(bytes, 8) !== "WEBP") {
    return rejected("not-webp");
  }
  if (view(bytes).getUint32(4, true) + CHUNK_HEADER_BYTES !== bytes.length) {
    return rejected("size-mismatch");
  }
  const chunks = readChunks(bytes);
  return typeof chunks === "string" ? rejected(chunks) : inspectLayout(chunks);
}
